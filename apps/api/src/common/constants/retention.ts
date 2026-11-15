/**
 * How long log-type records (notifications, audit logs) stay in MongoDB before a TTL index
 * removes them. Business records (stock movements, requisitions, transfers, purchase orders,
 * waste, stock counts, production) are never expired: reports and supplier/consignment
 * statements are rebuilt from them.
 */
export const LOG_RETENTION_DAYS = 180;

export const LOG_RETENTION_SECONDS = LOG_RETENTION_DAYS * 24 * 60 * 60;
