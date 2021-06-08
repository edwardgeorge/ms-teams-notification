import * as core from '@actions/core'
import {Octokit} from '@octokit/rest'
import axios from 'axios'
import moment from 'moment-timezone'
import {createMessageCard} from './message-card'
import fs from 'fs'

const escapeMarkdownTokens = (text: string) =>
  text
    .replace(/\n\ {1,}/g, '\n ')
    .replace(/\_/g, '\\_')
    .replace(/\*/g, '\\*')
    .replace(/\|/g, '\\|')
    .replace(/#/g, '\\#')
    .replace(/-/g, '\\-')
    .replace(/>/g, '\\>')

async function run(): Promise<void> {
  try {
    const githubToken = core.getInput('github-token', {required: true})
    const msTeamsWebhookUri: string = core.getInput('ms-teams-webhook-uri', {
      required: true
    })

    const notificationSummary =
      core.getInput('notification-summary') || 'GitHub Action Notification'
    const notificationColor = core.getInput('notification-color') || '0b93ff'
    const timezone = core.getInput('timezone') || 'UTC'
    const useWorkflowRun = core.getBooleanInput('use-workflow-run-event')
    let wfevent

    if (useWorkflowRun && process.env.GITHUB_EVENT_PATH) {
      const filedata = await fs.promises.readFile(
        process.env.GITHUB_EVENT_PATH,
        'utf8'
      )
      wfevent = JSON.parse(filedata).workflow_run || {}
    } else {
      wfevent = {}
    }

    const timestamp = moment()
      .tz(timezone)
      .format('dddd, MMMM Do YYYY, h:mm:ss a z')

    const [owner, repo] = (process.env.GITHUB_REPOSITORY || '').split('/')
    const sha = wfevent.head_sha || process.env.GITHUB_SHA || ''
    const runId = wfevent.id || process.env.GITHUB_RUN_ID || ''
    const runNum = wfevent.run_number || process.env.GITHUB_RUN_NUMBER || ''
    const params = {owner, repo, ref: sha}
    const repoName = params.owner + '/' + params.repo
    const repoUrl = `https://github.com/${repoName}`

    const octokit = new Octokit({auth: `token ${githubToken}`})
    const commit = await octokit.repos.getCommit(params)
    const author = commit.data.author

    const messageCard = await createMessageCard(
      notificationSummary,
      notificationColor,
      commit,
      author,
      runNum,
      runId,
      repoName,
      sha,
      repoUrl,
      timestamp
    )

    console.log(messageCard)

    axios
      .post(msTeamsWebhookUri, messageCard)
      .then(function(response) {
        console.log(response)
        core.debug(response.data)
      })
      .catch(function(error) {
        core.debug(error)
      })
  } catch (error) {
    console.log(error)
    core.setFailed(error.message)
  }
}

run()
