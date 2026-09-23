#!/usr/bin/env node
import { runPrivacy } from "./entry-privacy.mjs";
runPrivacy("contract").catch((error) => { console.error(error); process.exitCode = 2; });
