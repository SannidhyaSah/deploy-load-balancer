import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { ApiKey } from '@/lib/models/ApiKey';
import { logError } from '@/lib/services/logger';

export async function PATCH(req: NextRequest) {
  let action: string = 'unknown'; // Declare action outside try block
  try {
    const body = await req.json();
    action = body.action;
    const { keyIds, dailyRequestLimit } = body;

    if (!action || (action !== 'setLimit' && action !== 'delete')) {
        return NextResponse.json({ error: 'Invalid or missing action specified. Must be "setLimit" or "delete".' }, { status: 400 });
    }
    if (!Array.isArray(keyIds) || keyIds.length === 0) {
      return NextResponse.json({ error: 'keyIds must be a non-empty array' }, { status: 400 });
    }
    if (keyIds.some(id => typeof id !== 'string' || id.trim() === '')) {
        return NextResponse.json({ error: 'All keyIds must be non-empty strings' }, { status: 400 });
    }

    if (action === 'setLimit') {
        if (dailyRequestLimit !== null && (typeof dailyRequestLimit !== 'number' || !Number.isInteger(dailyRequestLimit) || dailyRequestLimit < 0)) {
            return NextResponse.json({ error: 'dailyRequestLimit must be a non-negative integer or null' }, { status: 400 });
        }
    }

    const db = await getDb();

    const placeholders = keyIds.map(() => '?').join(',');
    let result;
    let successMessage = '';
    let count = 0;

    if (action === 'setLimit') {
        const stmt = await db.prepare(
            `UPDATE api_keys SET dailyRateLimit = ? WHERE _id IN (${placeholders})`
        );
        result = await stmt.run(dailyRequestLimit, ...keyIds);
        await stmt.finalize();
        count = result.changes || 0;
        successMessage = `Successfully updated daily limit for ${count} keys.`;
        if (count === 0) {
            console.warn(`Bulk update limit attempted for key IDs [${keyIds.join(', ')}] but no rows were changed.`);
        }

    } else if (action === 'delete') {
        const stmt = await db.prepare(
            `DELETE FROM api_keys WHERE _id IN (${placeholders})`
        );
        result = await stmt.run(...keyIds);
        await stmt.finalize();
        count = result.changes || 0;
        successMessage = `Successfully deleted ${count} keys.`;
        if (count === 0) {
            console.warn(`Bulk delete attempted for key IDs [${keyIds.join(', ')}] but no rows were changed.`);
        }
    }

    return NextResponse.json({ message: successMessage, count });

  } catch (error: any) {
    logError(error, { context: `API Bulk Key Action (${action})` });
    let errorMessage = `Failed to perform bulk key action (${action})`;
    if (error instanceof SyntaxError) {
        errorMessage = 'Invalid request body format.';
    } else if (error.message) {
    }
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}