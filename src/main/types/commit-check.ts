export interface CommitCheck {
    sha: string;
    tree_sha: string;
    commit_date: Date;
    parents: string[];
    deployed_at: Date | null;
}