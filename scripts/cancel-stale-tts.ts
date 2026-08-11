import {
  listActiveTtsJobs,
  neutralizeStaleTtsJobs,
} from "../src/lib/tts/queue";

async function main() {
  const result = await neutralizeStaleTtsJobs();
  const active = await listActiveTtsJobs();
  console.log(JSON.stringify({ ...result, activeLeft: active.length }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
