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

// 1. Ensure `realtime` schema objects exist and check their RLS
runSQL("select tablename, rowsecurity from pg_tables where schemaname = 'realtime';");

// 2. Allow anon to select channels and insert messages
runSQL("CREATE POLICY anon_read_channels ON realtime.channels FOR SELECT USING (true);");
runSQL("CREATE POLICY anon_insert_messages ON realtime.messages FOR INSERT WITH CHECK (true);");
runSQL("CREATE POLICY anon_select_messages ON realtime.messages FOR SELECT USING (true);");
