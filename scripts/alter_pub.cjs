const cp = require('child_process');
try {
    const out = cp.execSync(`npx insforge db query "ALTER PUBLICATION supabase_realtime ADD TABLE matches;" --json`).toString();
    console.log(out);
} catch (e) {
    console.error(e.message);
    if(e.stdout) console.log(e.stdout.toString());
}
