import { desc, eq, notInArray } from 'drizzle-orm'

import { createDb, type DbClient } from '../db'
import { billingAlerts } from '../db/schema'

let dbClient: DbClient | null = null

function getDb() {
  dbClient ??= createDb()
  return dbClient
}

export class BillingAlertRepository {
  async listBillingAlerts() {
    const db = getDb()
    return db.select().from(billingAlerts).orderBy(desc(billingAlerts.createdAt))
  }

  async syncBillingAlerts(rows: Array<typeof billingAlerts.$inferInsert>) {
    const db = getDb()

    await db.transaction(async (tx) => {
      if (rows.length === 0) {
        await tx.delete(billingAlerts)
        return
      }

      for (const row of rows) {
        await tx
          .insert(billingAlerts)
          .values(row)
          .onConflictDoUpdate({
            target: billingAlerts.id,
            set: {
              alertType: row.alertType,
              severity: row.severity,
              entityType: row.entityType,
              entityId: row.entityId,
              message: row.message,
              metadataJson: row.metadataJson,
              createdAt: row.createdAt,
            },
          })
      }

      await tx.delete(billingAlerts).where(notInArray(billingAlerts.id, rows.map((row) => row.id)))
    })
  }

  async acknowledgeBillingAlert(id: string) {
    const db = getDb()
    const [updated] = await db
      .update(billingAlerts)
      .set({
        acknowledgedAt: new Date(),
      })
      .where(eq(billingAlerts.id, id))
      .returning()

    return updated ?? null
  }
}
