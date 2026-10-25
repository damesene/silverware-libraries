/// <reference types="node" />
// A Playwright reporter writing the run's summary to the GitHub Actions job
// summary (GITHUB_STEP_SUMMARY): the counts, then each test that failed (its
// place and the first line of its error) and each that passed only when retried.
// Without GITHUB_STEP_SUMMARY (a local run) it does nothing.
import { appendFileSync } from "node:fs";
import { relative } from "node:path";
import type { FullResult, Reporter, TestCase, TestResult } from "@playwright/test/reporter";

export default class SummaryReporter implements Reporter {
  private readonly tests = new Map<TestCase, TestResult>();

  onTestEnd(test: TestCase, result: TestResult): void {
    // The last attempt counts
    this.tests.set(test, result);
  }

  onEnd(result: FullResult): void {
    const file = process.env.GITHUB_STEP_SUMMARY;
    if (!file) return;
    const outcomes = [...this.tests.keys()].map((test) => ({ test, outcome: test.outcome() }));
    const of = (outcome: string) => outcomes.filter((o) => o.outcome === outcome).map((o) => o.test);
    const failed = of("unexpected");
    const flaky = of("flaky");
    const place = (test: TestCase) => `\`${relative(process.cwd(), test.location.file)}:${test.location.line}\``;
    const name = (test: TestCase) => `${place(test)} ${test.titlePath().slice(3).join(" › ").replaceAll("|", "\\|")}`;
    const firstLine = (test: TestCase) => (this.tests.get(test)?.error?.message ?? "").replace(/\u001b\[[0-9;]*m/g, "").split("\n")[0]!.trim();
    const lines = [
      `## Interaction tests: ${process.env.SW_TARGET ?? "playground"} (${result.status})`,
      "",
      "| Passed | Failed | Flaky | Skipped |",
      "|--:|--:|--:|--:|",
      `| ${of("expected").length} | ${failed.length} | ${flaky.length} | ${of("skipped").length} |`,
      "",
    ];
    if (failed.length) lines.push("### Failed", "", ...failed.map((test) => `- ${name(test)}: ${firstLine(test)}`), "");
    if (flaky.length) lines.push("### Passed only when retried", "", ...flaky.map((test) => `- ${name(test)}`), "");
    if (failed.length || flaky.length) lines.push("The HTML report (an artifact of this run) has each test's error, screenshot, trace and browser console.", "");
    appendFileSync(file, `${lines.join("\n")}\n`);
  }
}
