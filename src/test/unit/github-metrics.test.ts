import {GitHubMetrics} from "../../main/github-metrics";
import {Octokit} from "@octokit/rest";

describe('metrics', function() {
    it('should filter unmerged and old PRs', function () {
        let ghm = new GitHubMetrics('foo', new Octokit, 1);
        let result = Object.getPrototypeOf(ghm);
        expect(result.filterOutUnmergedAndOldPullRequests('2022-03-30T12:12:12Z', new Date())).toBe(true);
        expect(result.filterOutUnmergedAndOldPullRequests('2021-03-30T12:12:12Z', new Date())).toBe(false);
        expect(result.filterOutUnmergedAndOldPullRequests(null, new Date())).toBe(false);
    });
});