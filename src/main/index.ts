// src/index.ts

import yargs from 'yargs';
import * as figlet from 'figlet';
import ora from 'ora';
import { Octokit } from "@octokit/rest";
import { GitHubMetrics } from "./github-metrics";

const args = yargs.options({
  'api-key': { type: 'string', demandOption: true, alias: 'a' },
  'owner': { type: 'string', default: 'hmcts', alias: 'o'},
  'days': { type: 'number', default: 30, alias: 'd'}

  //'url': { type: 'string', demandOption: true, alias: 'u' },
  //'instructions': { type: 'array', demandOption: true, alias: 'i' },
}).argv;

console.log(figlet.textSync('Four Key Metrics', { horizontalLayout: 'full' }));
console.info('This tool will calculate the 4 key metrics for each configured team at HMCTS. For more \n' +
    'information on What the Four Key Metrics are have a read of the book, "Accelerate". Preview available \n' +
    'https://www.google.co.uk/books/edition/Accelerate/Kax-DwAAQBAJ?hl=en&gbpv=1&pg=PT37&printsec=frontcover\n\n\n');

// console.log(args);

const octokit = new Octokit({
  auth: args["api-key"]
});
const ghMetrics = new GitHubMetrics(args.owner, octokit, args.days);
const spinner = ora(`Gathering info...\n`).start();
const now = new Date();
ghMetrics.run().finally(() => {
  console.log("Complete in " + (new Date().getTime() - now.getTime()) + "ms");
  console.log();
  spinner.stop();
});
