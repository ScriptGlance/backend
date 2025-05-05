import { ViewEntity, ViewColumn } from 'typeorm';
import { SubscriptionStatus } from '../enum/SubscriptionStatus';

@ViewEntity({
  name: 'user_with_premium',
  expression: `
    SELECT
      u.user_id                     AS user_id,
      u.first_name                  AS first_name,
      u.last_name                   AS last_name,
      COALESCE(s.status = '${SubscriptionStatus.ACTIVE}', FALSE)
        AS has_premium
    FROM "user" u
    LEFT JOIN subscription s
      ON s.user_id = u.user_id
  `,
})
export class UserWithPremiumEntity {
  @ViewColumn() user_id: number;
  @ViewColumn() has_premium: boolean;
}
