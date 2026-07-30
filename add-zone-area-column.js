const { Client } = require('pg');

const databases = [
    {
        name: 'Production',
        connectionString: 'postgresql://postgres.biffdmqmyxomosdjlguc:o8uhza5tIwo3sucA@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres'
    },
    {
        name: 'Development',
        connectionString: 'postgresql://postgres.rdgtplphyxfdetkopnho:o8uhza5tIwo3sucA@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres'
    }
];

const sql = `
-- Add zone_area column to profiles table if it doesn't exist
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS zone_area TEXT;
`;

async function run() {
    for (const db of databases) {
        console.log(`\nConnecting to ${db.name} Database...`);
        const client = new Client({
            connectionString: db.connectionString,
            ssl: { rejectUnauthorized: false }
        });
        
        try {
            await client.connect();
            console.log(`Connected to ${db.name}. Executing SQL...`);
            await client.query(sql);
            console.log(`✅ Success! zone_area column added to profiles on ${db.name} database.`);
        } catch (err) {
            console.error(`❌ Error on ${db.name}:`, err.message);
        } finally {
            await client.end();
        }
    }
}

run();
