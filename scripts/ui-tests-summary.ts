/// <reference types="node" />
// A Playwright reporter writing the run's summary to the GitHub Actions job
// summary (GITHUB_STEP_SUMMARY): the counts, then each test that failed (its
// place and the first line of its error) and each that passed only when retried.
// Without GITHUB_STEP_SUMMARY (a local run) it writes none.
// And a test's warnings (its annotations of type `warning`: something to look
// at that fails nothing, as a look compared off a little), however it ended:
// in GitHub Actions a warning of the run's each (yellow on the run and the pull
// request, no log opened) and a part of the summary; else a yellow line each in
// the console at the run's end.
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
    const place = (test: TestCase) => `${relative(process.cwd(), test.location.file)}:${test.location.line}`;
    const title = (test: TestCase) => test.titlePath().slice(3).join(" › ");
    const warnings = [...this.tests].flatMap(([test, last]) => last.annotations.filter((one) => one.type === "warning").map((one) => ({ test, text: one.description ?? "" })));
    if (process.env.GITHUB_ACTIONS) {
      // (GitHub's workflow command: a line of the step's output; its message on one line, its % escaped)
      const escaped = (text: string) => text.replaceAll("%", "%25").replaceAll("\r", "%0D").replaceAll("\n", "%0A");
      for (const { test, text } of warnings) {
        const file = relative(process.cwd(), test.location.file).replaceAll("\\", "/");
        process.stdout.write(`::warning file=${file},line=${test.location.line},title=${escaped(title(test)).replaceAll(",", "%2C").replaceAll("::", "%3A%3A")}::${escaped(text)}\n`);
      }
    } else for (const { test, text } of warnings) process.stdout.write(`\u001b[33mWarning: ${title(test)} (${place(test)}): ${text}\u001b[0m\n`);

    const file = process.env.GITHUB_STEP_SUMMARY;
    if (!file) return;
    const outcomes = [...this.tests.keys()].map((test) => ({ test, outcome: test.outcome() }));
    const of = (outcome: string) => outcomes.filter((o) => o.outcome === outcome).map((o) => o.test);
    const failed = of("unexpected");
    const flaky = of("flaky");
    const name = (test: TestCase) => `\`${place(test)}\` ${title(test).replaceAll("|", "\\|")}`;
    const firstLine = (test: TestCase) => (this.tests.get(test)?.error?.message ?? "").replace(/\u001b\[[0-9;]*m/g, "").split("\n")[0]!.trim();
    const lines = [
      `## Interaction tests: ${process.env.SW_TARGET ?? "playground"} (${result.status})`,
      "",
      "| Passed | Failed | Flaky | Skipped | Warnings |",
      "|--:|--:|--:|--:|--:|",
      `| ${of("expected").length} | ${failed.length} | ${flaky.length} | ${of("skipped").length} | ${warnings.length} |`,
      "",
    ];
    if (failed.length) lines.push("### Failed", "", ...failed.map((test) => `- ${name(test)}: ${firstLine(test)}`), "");
    if (flaky.length) lines.push("### Passed only when retried", "", ...flaky.map((test) => `- ${name(test)}`), "");
    if (warnings.length) lines.push("### Warnings", "", ...warnings.map(({ test, text }) => `- ${name(test)}: ${text.replaceAll("|", "\\|")}`), "");
    if (failed.length || flaky.length || warnings.length) lines.push("The HTML report (an artifact of this run) has each test's error, screenshot, trace and browser console, and the crops a warning names.", "");
    appendFileSync(file, `${lines.join("\n")}\n`);
  }
}
