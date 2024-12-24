```markdown
# Order App

The Order App for Shopify is designed to streamline order management for merchants by integrating seamlessly with the store's webhook. It captures and stores orders efficiently, providing a system to track and tag orders, and enabling easy data export for detailed analysis.

## Quick start

### Prerequisites

Before you begin, you'll need the following:

- **Node.js**: Download and install Node v22.2.0
- **Shopify Partner Account**: Create an account if you don't have one.
- **Test Store**: Set up either a development store or a Shopify Plus sandbox store for testing your app.

### Setup

If you used the CLI to create the template, you can skip this section.

Using yarn:

```sh
yarn install
```

Using npm:

```sh
npm install
```

### Local Development

Using yarn:

```sh
yarn dev
```

Using npm:

```sh
npm run dev
```

### Deploy and apply changes

```sh
npm run deploy
```

## Database

### Order Table

| Column Name      | Datatype | Note                             |
|------------------|----------|----------------------------------|
| id               | Integer  | Primary Key; Default(Auto Increment) |
| shopifyOrderId   | String   | Not null                         |
| orderNumber      | String   | Not null                         |
| totalPrice       | String   | Not null                         |
| paymentGateway   | String   | Nullable                         |
| customerEmail    | String   | Nullable                         |
| customerFullName | String   | Nullable                         |
| customerAddress  | String   | Nullable                         |
| tags             | String   | Nullable                         |
| createdAt        | DateTime | Default(Now)                     |
| updatedAt        | DateTime | Default(Now)                     |

### Tag Table

| Column Name | Datatype | Note                             |
|-------------|----------|----------------------------------|
| id          | Integer  | Primary Key; Default(Auto Increment) |
| name        | String   | Not null; Unique                 |
| createdAt   | DateTime | Default(Now)                     |

### OrderTag Table

| Column Name | Datatype | Note                             |
|-------------|----------|----------------------------------|
| id          | Integer  | Primary Key; Default(Auto Increment) |
| orderId     | Integer  | Foreign Key (references Order.id) |
| tagId       | Integer  | Foreign Key (references Tag.id)  |
| createdAt   | DateTime | Default(Now)                     |

### Migration

Migrate Order Table:

```sh
npm run prisma migrate dev --name create-order-table
```

Open Prisma Studio:

```sh
npm run prisma studio
```

## Unit test

Running unit test:

```sh
npm run test
```

## Webhook Configuration

Please note that this app uses API v3. Please read the guide below for configuration.

### Guide webhooks

List of subscription topics:

```toml
[webhooks]
api_version = "2024-04"

  [[webhooks.subscriptions]]
  topics = [ "orders/create", "orders/edited", "orders/updated" ]
  uri = "/webhooks/app/orders"

  [[webhooks.subscriptions]]
  topics = [ "app/scopes_update" ]
  uri = "/webhooks/app/scopes_update"

  [[webhooks.subscriptions]]
  topics = [ "app/uninstalled" ]
  uri = "/webhooks/app/uninstalled"
```
