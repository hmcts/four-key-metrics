import {CommitCheck} from "./commit-check";
import {FilteredCommitCheck} from "./filtered-commit-check";

export class FilteredCommitChecks {

    private readonly commitChecks: CommitCheck[];

    constructor(commitChecks: CommitCheck[]) {
        this.commitChecks = commitChecks;
    }

    public getFilteredCommitChecks(): FilteredCommitCheck[] {
        // @ts-ignore
        return this.commitChecks.filter(d => d.deployed_at !== null);
    }

}