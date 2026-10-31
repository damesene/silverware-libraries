// The tags playground's space: pages with tags in every form SilverBullet reads
// (a frontmatter's list, its list in brackets, its string; tag lines; hashtags
// in text, items, tasks, a table, code that holds none), in folders
export const SAMPLE_PAGES: Readonly<Record<string, string>> = {
  index: "# Welcome\n\nA space to try Silverware Tags: open the **Manager**, **Tag pages** or **Page tags** above.\n",
  "Projects/Alpha": "---\ntitle: Project Alpha\ntags:\n  - project/alpha\n  - active\n---\n# Alpha\n\n- [ ] Write the brief #todo\n- [x] Kick-off #done\n",
  "Projects/Alpha/Plan": "#project/alpha #plan\n\nThe plan of Alpha.\n\n- Phase one #milestone\n- Phase two #milestone\n",
  "Projects/Beta": "---\ntags: [project/beta]\n---\n# Beta\n\nOn hold. #idea\n",
  "Meetings/2026-10-01": "---\ntags: meeting, project/alpha\n---\nWe agreed on the scope. #decision\n\n| Who | What |\n|---|---|\n| Ann | the brief #todo |\n",
  "Meetings/2026-10-15": "#meeting\n\n- [ ] Send the notes #todo\n",
  "Journal/2026-10-30": "Thinking about #idea of a garden.\n\n```\n#notatag in code\n```\n",
  "Recipes/Soup": "---\ntitle: Soup\n---\nCarrots, onions, salt.\n",
};
