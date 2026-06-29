#!/usr/bin/env python3
"""Build the single canonical feature tracker spreadsheet (feature-tracker.csv).

Sources (both pipe-delimited, ' | '):
  feature_specs.psv   - immutable: ID | Feature | User Story | Expected Behaviour | Source
  feature_status.psv  - mutable:   ID | Status | Test Result | Issues / Notes

Run: python3 docs/build_tracker.py
"""
import csv
import os

HERE = os.path.dirname(os.path.abspath(__file__))
SPECS = os.path.join(HERE, "feature_specs.psv")
STATUS = os.path.join(HERE, "feature_status.psv")
OUT = os.path.join(HERE, "feature-tracker.csv")

AREA = {
    "LOG": "Log", "STATS": "Stats", "HIST": "History",
    "PROG": "Program", "SET": "Settings", "SHELL": "Shell / PWA",
}


def read_psv(path, ncols):
    rows = {}
    order = []
    with open(path, encoding="utf-8") as f:
        for i, line in enumerate(f):
            line = line.rstrip("\n")
            if not line.strip():
                continue
            parts = [p.strip() for p in line.split("|")]
            if i == 0 and parts and parts[0] == "ID":
                continue  # header
            parts += [""] * (ncols - len(parts))
            rows[parts[0]] = parts[1:ncols]
            order.append(parts[0])
    return rows, order


def main():
    specs, order = read_psv(SPECS, 5)
    status = {}
    if os.path.exists(STATUS):
        status, _ = read_psv(STATUS, 4)

    with open(OUT, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow([
            "ID", "Area", "Feature", "User Story", "Expected Behaviour",
            "Source", "Status", "Test Result", "Issues / Notes",
        ])
        for fid in order:
            feat, story, behav, src = specs[fid]
            area = AREA.get(fid.split("-")[0], "")
            st = status.get(fid, ["Spec'd", "", ""])
            w.writerow([fid, area, feat, story, behav, src, st[0], st[1], st[2]])

    print(f"Wrote {OUT} with {len(order)} features.")


if __name__ == "__main__":
    main()
