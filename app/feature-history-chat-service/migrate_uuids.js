require('dotenv').config();
const { Client } = require('pg');
const { v4: uuidv4 } = require('uuid');

const client = new Client({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

async function main() {
  let client;
  try {
    await client.connect();
    console.log('Connected to PostgreSQL');

    // Start transaction
    await client.query('BEGIN');
    console.log('Transaction started');

    // 1. Find content IDs that don't have 'chatId' meta entry
    const query = `
      SELECT c2.id as "Content 2 ID"
      FROM contents c2
      WHERE c2.id NOT IN (
        SELECT c.id
        FROM contents c
        LEFT JOIN meta_names mn ON mn.content_id = c.id
        WHERE mn.meta_name = 'chatId'
      );
    `;
    const contents = await client.query(query);
    const contentIds = contents.rows.map(row => row['Content 2 ID']);

    if (contentIds.length === 0) {
      console.log('All contents already have a chatId meta entry. Nothing to migrate.');
      await client.query('COMMIT');
      return;
    }

    console.log(`Found ${contentIds.length} contents without chatId.`);

    // 2. For each content, generate UUID and insert meta entry
    let insertedCount = 0;

    for (const contentId of contentIds) {
      const uuid = uuidv4();
      console.log(`Processing content ${contentId} with UUID ${uuid}`);

      // Insert meta_names entry
      const metaQuery = `
        INSERT INTO meta_names (meta_name, content_id)
        VALUES ('chatId', $1)
        RETURNING id;
      `;
      const metaResult = await client.query(metaQuery, [contentId]);
      const metaId = metaResult.rows[0].id;

      // Insert long_text_meta_value entry
      const valueQuery = `
        INSERT INTO long_text_meta_value (string_meta_value, meta_names_id)
        VALUES ($1, $2);
      `;
      await client.query(valueQuery, [uuid, metaId]);

      insertedCount++;
    }

    console.log(`Successfully migrated ${insertedCount} entries.`);

    // Commit transaction
    await client.query('COMMIT');
    console.log('Transaction committed successfully');

  } catch (error) {
    console.error('Migration failed. Rolling back...');
    try {
      await client.query('ROLLBACK');
      console.log('Transaction rolled back');
    } catch (rollbackError) {
      console.error('Rollback failed:', rollbackError);
    }
    throw error;
  } finally {
    await client.end();
    console.log('Database connection closed');
  }
}

main().catch(err => {
  console.error('Script failed:', err);
  process.exit(1);
});
