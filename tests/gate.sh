#!/bin/bash
# ---------------------------------------------------------------------------
# The gate. Everything that has to hold before anything ships.
#
# Thirteen suites and fifty-four probes. The split is not arbitrary: a SUITE is
# a broad net over one dimension (structure, layout, arithmetic, palette, the
# hostile pass), while a PROBE is narrow and was written the day a specific
# thing was reported, usually from a phone screenshot, and it stays because the
# report will come back if the property does not.
#
# It REFUSES rather than reports. A gate you can read past is a gate you will
# read past on the day you are in a hurry, which is the only day it matters.
#
# Run it from the repo root:   bash tests/gate.sh
# Read the log it leaves:      $LOG below (override with GATE_LOG=/some/path)
#
# The probes lived in a scratchpad directory for most of their life, which meant
# every one of them would have vanished with the container that made them. They
# are in tests/probes/ now. If you add one, add its name to PROBES.
# ---------------------------------------------------------------------------
set -u
cd "$(dirname "$0")/.." || exit 1
LOG="${GATE_LOG:-$(pwd)/gate.log}"
: > "$LOG"
FAILED=0

SUITES="structure layout hostile math_audit math_edges math_golden math_claims
        palette budget_sim life_units intake_cost talk_through funnel"

PROBES="credit rates acct swipe cardfind qlparse qlocr qlblank brief working
        order acctedit acctgrp room heloc tracked cal faces arrive deadpanel
        unexplained debtkind timebudget plain lightintro intake5 netlabel scan
        monthhome growthcat intake6 logone newmonth syncgate syncerr syncmerge
        acctsay synclock build synctraffic cellmerge cellmerge2 saymode deck
        glance contrast voice balcol putaway carry monthdead showwork equity
        twotabs"

for t in $SUITES; do
  echo "=== $t ===" >> "$LOG"
  out=$(timeout 1800 node "tests/$t.mjs" 2>&1); code=$?
  echo "$out" | grep -E "hold$|properties hold|claims hold|verified" | tail -2 >> "$LOG"
  echo "$out" | grep -A3 "^FAIL" | head -30 >> "$LOG"
  echo "$out" | grep -E "page errors" | tail -1 >> "$LOG"
  echo "exit=$code" >> "$LOG"
  [ $code -ne 0 ] && FAILED=1
done

for probe in $PROBES; do
  out=$(timeout 900 node "tests/probes/$probe.mjs" 2>&1); code=$?
  echo "=== probe $probe ===" >> "$LOG"
  lines=$(echo "$out" | grep -E "^FAIL|hold$" -A2 | tail -6)
  # A probe that reports in prose matches neither pattern. Never leave a section
  # blank: a silent section reads exactly like a probe that did not run, and a
  # gate you cannot tell apart from a gate that skipped is not a gate.
  [ -z "$lines" ] && lines=$(echo "$out" | grep -v "^$" | tail -2)
  [ -z "$lines" ] && lines="(no output at all - probe produced nothing)"
  echo "$lines" >> "$LOG"
  echo "exit=$code" >> "$LOG"
  [ $code -ne 0 ] && FAILED=1
done

if [ $FAILED -ne 0 ]; then
  echo "GATE: REFUSED" >> "$LOG"
  echo "GATE: REFUSED - see $LOG"
  awk '/^=== /{p=$0} /^FAIL|exit=[1-9]/{print p" >> "$0}' "$LOG" | head -20
  exit 1
fi
echo "GATE: CLEAN" >> "$LOG"
echo "GATE: CLEAN - $(grep -c 'exit=0' "$LOG") sections, log at $LOG"
