export interface Team {
    name: string;
    mergedPullRequests: number;
    numDeployments: number;
    deployGaps: any[];
    deliveryLeadTimes: number[];
    repos: string[];
}