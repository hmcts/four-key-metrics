import {Octokit} from "@octokit/rest";
import { RestEndpointMethodTypes } from "@octokit/plugin-rest-endpoint-methods"
///dist-types/generated/parameters-and-response-types.d.ts

import {TeamMetrics} from "./types/team-metrics";
import {CommitCheck} from "./types/commit-check";
import {FilteredCommitChecks} from "./types/filtered-commit-checks";
import {FilteredCommitCheck} from "./types/filtered-commit-check";
import {bold, cyan, green, red, yellow} from "kleur/colors";
import { Logger } from "tslog";
type reposListCommitsResponse =  RestEndpointMethodTypes["repos"]["listCommits"]["response"]["data"];
type checksListForRefResponseData = RestEndpointMethodTypes["checks"]["listForRef"]["response"]["data"];

export class GitHubMetrics {
    private readonly octokit: Octokit;
    private readonly owner: string;
    private readonly days: number;
    private readonly teamMetrics: TeamMetrics;
    private readonly log: Logger;


    constructor(owner: string, octokit: Octokit, days: number) {
        this.octokit = octokit;
        this.owner = owner;
        this.days = days;
        this.log = new Logger({
            name: this.constructor.name,
            minLevel: "info"
        });

        // @todo move this into json/yaml config
        this.teamMetrics = {
            "fact": {
                name: 'fact',
                mergedPullRequests: 0,
                numDeployments: 0,
                deployGaps: [],
                deliveryLeadTimes: [],
                repos: [
                    "fact-frontend",
                    "fact-admin",
                    "fact-api"
                ]
            },
            "probate": {
                name: 'probate',
                mergedPullRequests: 0,
                numDeployments: 0,
                deployGaps: [],
                deliveryLeadTimes: [],
                repos: [
                    'probate-back-office',
                    'probate-frontend',
                    'probate-orchestrator-service',
                    'probate-submit-service',
                    'probate-caveats-frontend',
                    'probate-commons',
                    'probate-shared-infrastructure'
                ]
            },
            "bsp": {
                name: 'bsp',
                mergedPullRequests: 0,
                numDeployments: 0,
                deployGaps: [],
                deliveryLeadTimes: [],
                repos: [
                    'send-letter-service',
                    'send-letter-client',
                    'reform-scan-shared-infra',
                    'bulk-scan-orchestrator',
                    'bulk-scan-processor',
                    'bulk-scan-payment-processor',
                    'bulk-scan-shared-infrastructure',
                    'blob-router-service'
                ]
            },
            "nfd": {
                name: 'nfd',
                mergedPullRequests: 0,
                numDeployments: 0,
                deployGaps: [],
                deliveryLeadTimes: [],
                repos: [
                    'nfdiv-shared-infrastructure',
                    'nfdiv-case-api',
                    'nfdiv-frontend'
                ]
            },
            "finrem": {
                name: 'finrem',
                mergedPullRequests: 0,
                numDeployments: 0,
                deployGaps: [],
                deliveryLeadTimes: [],
                repos: [
                    'finrem-shared-infrastructure',
                    'finrem-document-generator-client',
                    'finrem-evidence-management-client-api',
                    'finrem-payment-service',
                    'finrem-notification-service',
                    'finrem-case-orchestration-service'
                ]
            },
            "divorce": {
                name: 'divorce',
                mergedPullRequests: 0,
                numDeployments: 0,
                deployGaps: [],
                deliveryLeadTimes: [],
                repos: [
                    'div-service-auth-provider-client',
                    'div-fees-and-payments-service',
                    'div-shared-infrastructure',
                    'div-decree-absolute-frontend',
                    'div-pay-client',
                    'div-evidence-management-client-api',
                    'div-case-data-formatter',
                    'div-document-generator-client',
                    'div-respondent-frontend',
                    'div-case-maintenance-service',
                    'div-decree-nisi-frontend',
                    'div-case-orchestration-service',
                    'div-petitioner-frontend'
                ]
            }
        };
    }

    public run(): Promise<void> {
        // init the start date
        const now = new Date();
        let daysAgo = new Date(now.getTime() - (this.days * 24 * 60 * 60 * 1000));
        daysAgo.setHours(0,0,0,0);

        let metrics: Promise<any>[] = [];
        for(let t in this.teamMetrics) {
            this.teamMetrics[t].repos.map(repo => {
                metrics.push(this.processMetrics(repo, 'Jenkins', t, daysAgo));
            });
        }

        return Promise.all(metrics).then(value => {
            for(let t in this.teamMetrics) {
                const sumLeadTime = this.teamMetrics[t].deliveryLeadTimes.reduce((a, b) => a + b, 0);
                const meanLeadTime = (sumLeadTime / this.teamMetrics[t].deliveryLeadTimes.length) || 0;
                const sumDeploymentGaps = this.teamMetrics[t].deployGaps.reduce((a, b) => a + b, 0);
                const meanDeploymentGaps = (sumDeploymentGaps / this.teamMetrics[t].deployGaps.length) || 0;

                console.log(green(`############## ${this.teamMetrics[t].name} ##############`));
                console.log(`Found ` + bold(`${this.teamMetrics[t].mergedPullRequests}`) + ` merged Pull Requests in the last ${this.days} days.`);
                console.log(`Mean Lead Time is ${GitHubMetrics.formatDeploymentLeadTime(meanLeadTime)}.`);
                console.log(`Deployment frequency ${GitHubMetrics.formatDeploymentFrequency(meanDeploymentGaps)} (${this.teamMetrics[t].numDeployments} deployments in ${this.days} days).`);
            }
        });
    }

    private async processMetrics(repo: string, deploymentCheckName: string, team: string, daysAgo: Date): Promise<any> {

        const pulls = this.getPullsFromLastDays(this.owner, repo, daysAgo);
        const deploys = this.deployedCommits(this.owner, repo, daysAgo, deploymentCheckName);

        return Promise.all([pulls, deploys]).then((values => {

            const prs = values[0];
            const deploys = values[1];
            let deliveryLeadTimes: number[] = [];

            // console.log(`Found ` + bold(`${prs.length}`) + ` merged Pull Requests on ` + bold(`${this.owner}/${repo}`) + ` in the last ${this.days} days.`);
            prs.forEach(pr => {
                const mergedAt = new Date(Date.parse(pr.merged_at));
                // console.log(pr);
                // console.log(bold(`${pr.title}`));
                // console.log(`PR Merged at ${mergedAt.toISOString()}`);
                // console.log(`PR commit sha ${pr.merge_commit_sha}`);
                const deploymentAt = GitHubMetrics.findDeploymentTimeForCommit(pr.merge_commit_sha, deploys);
                if (deploymentAt !== undefined) {
                    // console.log(`Deployed at ${deploymentAt.toISOString()}`);
                    // console.log(`Deployment lead time = ${formatDeploymentLeadTime(deploymentAt - mergedAt)}`);
                    deliveryLeadTimes.push(deploymentAt.getTime() - mergedAt.getTime());
                } else {
                    // console.log(`Not deployed`.red);
                }
                // console.log('========================================');
            });

            const sumLeadTime = deliveryLeadTimes.reduce((a, b) => a + b, 0);
            const meanLeadTime = (sumLeadTime / deliveryLeadTimes.length) || 0;
            this.log.debug(`Mean Lead Time is ${GitHubMetrics.formatDeploymentLeadTime(meanLeadTime)}.`);
            let notNullDeploys: FilteredCommitCheck[] = new FilteredCommitChecks(deploys).getFilteredCommitChecks();
            let deployGaps = [];
            for (let i = 0; i < notNullDeploys.length - 1; i++) {
                deployGaps.push(notNullDeploys[i].deployed_at.getTime() - notNullDeploys[i + 1].deployed_at.getTime());
            }
            const sumDeploymentGaps = deployGaps.reduce((a, b) => a + b, 0);
            const meanDeploymentGaps = (sumDeploymentGaps / deployGaps.length) || 0;
            this.log.debug(`Deployment frequency ${GitHubMetrics.formatDeploymentFrequency(meanDeploymentGaps)} (${notNullDeploys.length} deployments in ${this.days} days).`);
            this.log.debug('=========================================');

            this.teamMetrics[team].mergedPullRequests += prs.length;
            this.teamMetrics[team].numDeployments += notNullDeploys.length;
            this.teamMetrics[team].deployGaps = this.teamMetrics[team].deployGaps.concat(deployGaps);
            this.teamMetrics[team].deliveryLeadTimes = this.teamMetrics[team].deliveryLeadTimes.concat(deliveryLeadTimes);
        }));
    }

    private static formatDeploymentLeadTime(t: number) {
        if (t === 0) {
            return red(`0`)
        }
        // less then 1 minute
        if (t < 60000) {
            return green(`${t / 1000} seconds`)
        }
        // less then 1 hour
        if (t < 60 * 60 * 1000) {
            return green(`${Math.round((t / 1000 / 60) * 10) / 10} minutes`)
        }
        // less then 1 day
        if (t < 60 * 60 * 24 * 1000) {
            return cyan(`${Math.round((t / 1000 / 60 / 60) * 10) / 10} hours`)
        }
        // less then 1 week
        if (t < 604800000) {
            return yellow(`${Math.round((t / 1000 / 60 / 60 / 24) * 10) / 10} days`)
        }

        return red(`${Math.round((t / 1000 / 60 / 60 / 24) * 10) / 10} days`)
    }

    private static formatDeploymentFrequency(t: number) {
        if (t === 0) {
            return red(`0`)
        }
        // less then 1 minute
        if (t < 60000) {
            return green(`${t / 1000} seconds`)
        }
        // less then 1 hour
        if (t < 60 * 60 * 1000) {
            return green(`${Math.round((t / 1000 / 60) * 10) / 10} minutes`)
        }
        // less then 3.5 hours
        if (t < 60 * 60 * 3.5 * 1000) {
            return green(`${Math.round((t / 1000 / 60 / 60) * 10) / 10} hours`)
        }
        // less then 1 day
        if (t < 60 * 60 * 24 * 1000) {
            return cyan(`${Math.round((t / 1000 / 60 / 60) * 10) / 10} hours`)
        }
        // less then 1 week
        if (t < 604800000) {
            return yellow(`${Math.round((t / 1000 / 60 / 60 / 24) * 10) / 10} days`)
        }

        return red(`${Math.round((t / 1000 / 60 / 60 / 24) * 10) / 10} days`)
    }

    private static findDeploymentTimeForCommit(sha: string, deployments: any[]): Date | undefined {
        let found = false;
        for(let i = deployments.length - 1; i >= 0; i--) {
            if (deployments[i].sha === sha && deployments[i].deployed_at !== null) {
                return deployments[i].deployed_at;
            }
            else if (found && deployments[i].deployed_at !== null) {
                return deployments[i].deployed_at;
            }
            else if (deployments[i].sha === sha) {
                found = true;
            }
        }
    }

    private async deployedCommits(owner: string, repo: string, daysAgo: Date, deploymentCheckName: string) {

        return this.octokit.repos.listCommits({
            owner,
            repo,
            // sha: pr.merge_commit_sha,
            since: daysAgo.toISOString()
        }).then(masterCommits => {
            let deployedCommits: Promise<CommitCheck>[] = [];
            masterCommits.data.forEach(c => {
                deployedCommits.push(this.getChecksForCommit(owner, repo, [c], deploymentCheckName));
            });
            return Promise.all(deployedCommits);
        });
    }

    private async getChecksForCommit(owner:string , repo: string, commit: reposListCommitsResponse, deploymentCheckName: string): Promise<CommitCheck> {
        let check = await this.octokit.checks.listForRef({
            owner,
            repo,
            ref: commit[0].sha
        });

        return GitHubMetrics.getFirstValidCommitCheckForCommit(deploymentCheckName, check.data, commit);
    }

    private static getFirstValidCommitCheckForCommit(deploymentCheckName: string,
                                                     runs: checksListForRefResponseData,
                                                     commit: reposListCommitsResponse): CommitCheck {
        const jenkinsCheck = (runs.check_runs.filter((chk: { name: string; }) => chk.name === deploymentCheckName))[0];

        let deployed_at = null;
        if (jenkinsCheck !== undefined && jenkinsCheck.conclusion === 'success') {
            deployed_at = new Date(Date.parse(jenkinsCheck.completed_at));
        }

        return {
            "sha": commit[0].sha,
            "tree_sha": commit[0].commit.tree.sha,
            "commit_date": new Date(Date.parse(commit[0].commit.committer.date)),
            "parents": commit[0].parents.map((p: { sha: any; }) => p.sha),
            "deployed_at": deployed_at
        };
    }

    private async getPullsFromLastDays(owner: string, repo: string, daysAgo: Date) {
        return this.octokit.pulls.list({
            owner: owner,
            repo: repo,
            state: 'closed',
            base: 'master',
            sort: 'updated',
            per_page: 100,
            direction: 'desc'
        }).then(({ data }) => data.filter(pr => this.filterOutUnmergedAndOldPullRequests(pr.merged_at, daysAgo)));
    }

    private filterOutUnmergedAndOldPullRequests(mergedAt: string, oldestDate: Date): boolean {
        return mergedAt != null && Date.parse(mergedAt) > oldestDate.getTime();
    }
}

