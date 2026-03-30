const cp = require('child_process');

function runSQL(sql) {
    console.log(`\n--- Running SQL ---`);
    console.log(sql);
    try {
        const out = cp.execSync(`npx insforge db query "${sql}" --json`).toString();
        console.log('Result:', out.substring(0, 300));
    } catch (err) {
        console.error('Error:', err.message);
        if (err.stdout) console.log(err.stdout.toString());
        if (err.stderr) console.log(err.stderr.toString());
    }
}

// Grant permissions to anon
runSQL("GRANT USAGE ON SCHEMA realtime TO anon;");
runSQL("GRANT ALL ON realtime.messages TO anon;");
runSQL("GRANT ALL ON realtime.channels TO anon;");

// Also check matches if we need it
runSQL("GRANT ALL ON public.matches TO anon;");
