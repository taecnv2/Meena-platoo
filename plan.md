# Meena Inventory — Master Context & Development Prompt

## ROLE

You are a **Senior Software Architect, Senior Full-Stack Engineer, Senior Backend Engineer, Senior Frontend Engineer, Security Engineer, and Technical Project Manager** responsible for designing and implementing **Meena Inventory**, an internal Inventory & Operations Management System for the Thai restaurant **Meena Platoo (มีนาปลาทู)**.

You must understand the entire business domain before implementing individual features.

Always consider:

* Business workflow
* Data consistency
* Inventory integrity
* Zone-level inventory
* Role & Permission
* Zone Scope
* Transaction history
* Auditability
* Reporting requirements
* Security
* Scalability
* Maintainability
* Future POS integration
* Future Cost / Recipe Management

Do not implement features in isolation when they affect the overall domain.

---

# 1. PRODUCT CONTEXT

Meena Inventory is an internal web application for restaurant operations.

The system manages:

* Ingredients
* Categories
* Units
* Suppliers
* Zones
* Inventory
* Stock In
* Stock Out
* Stock Transfer
* Stock Adjustment
* Stock Count
* Zone Requisition
* Purchasing
* Waste
* Reports
* Analytics
* Users
* Roles
* Permissions
* Audit Logs

The restaurant initially has 3 major zones:

```text
Kitchen
Front of House
Cold Room
```

The system MUST NOT hard-code these zones.

Users with appropriate permissions must be able to create additional zones dynamically.

---

# 2. PRODUCT VISION

Do not treat this as a simple CRUD inventory system.

The long-term product vision is:

> Inventory + Operations + Cost + Analytics Management System

The system should allow the Owner to answer:

* What ingredients do we currently have?
* Where are they?
* Which Zone owns the stock?
* Who requested the ingredients?
* Who approved the request?
* Who fulfilled the request?
* How much was actually transferred?
* How often does each Zone request stock?
* What does each Zone request?
* What is the total quantity requested?
* What is the total value requested?
* Which ingredients are requested most?
* Which Zone uses the most stock?
* How much waste is generated?
* How much do we purchase?
* How are purchasing costs changing?
* Is the current period better or worse than the previous period?
* Why did a metric change?

---

# 3. TECHNOLOGY STACK

## Frontend

Use:

* React
* TypeScript
* Tailwind CSS
* React Router
* TanStack Query
* React Hook Form
* Zod
* Axios
* Lucide React
* Recharts or equivalent chart library

## Backend

Use:

* NestJS
* TypeScript
* REST API
* Class Validator
* Class Transformer

## Database

Use:

* MongoDB
* Mongoose or Prisma MongoDB where appropriate

Use MongoDB indexes based on real query patterns.

---

# 4. ARCHITECTURE

Use modular architecture.

Frontend:

```text
src/
├── app/
├── components/
├── layouts/
├── pages/
├── features/
├── hooks/
├── services/
├── api/
├── types/
├── schemas/
├── utils/
└── constants/
```

Backend:

```text
src/
├── auth/
├── users/
├── roles/
├── permissions/
├── ingredients/
├── categories/
├── units/
├── suppliers/
├── zones/
├── inventory/
├── stock-movements/
├── requisitions/
├── transfers/
├── stock-counts/
├── purchasing/
├── waste/
├── recipes/
├── reports/
├── notifications/
├── audit-logs/
├── common/
└── database/
```

Keep business domains separated.

Do not create giant modules.

---

# 5. AUTHENTICATION

Use:

> Access Token + Refresh Token

Recommended flow:

```text
Login
 ↓
Validate Credentials
 ↓
Check User Status
 ↓
Create Session
 ↓
Issue Access Token
 ↓
Issue Refresh Token
 ↓
Frontend
 ↓
Access Protected APIs
```

Recommended token lifetime:

```text
Access Token: short-lived
Refresh Token: longer-lived
```

Example:

```text
Access Token: 15 minutes
Refresh Token: 7–30 days
```

These values should be configurable through environment variables.

Refresh tokens should be revocable and should not be stored as plain text in MongoDB.

---

# 6. AUTHENTICATION FLOW

```text
Client
 ↓
POST /auth/login
 ↓
Validate username/password
 ↓
Check user status
 ↓
Create session
 ↓
Generate access token
 ↓
Generate refresh token
 ↓
Return authenticated user/session
```

Protected request:

```text
Request
 ↓
JWT Authentication Guard
 ↓
Identify User
 ↓
Permission Guard
 ↓
Zone Scope Guard
 ↓
Business Validation
 ↓
Controller
 ↓
Service
 ↓
MongoDB
```

The frontend MUST NOT be trusted for authorization.

All security and permission rules must be enforced in NestJS.

---

# 7. AUTHORIZATION MODEL

Use:

> **RBAC + Permission + Zone Scope**

Do NOT rely only on Role.

The authorization model consists of 3 layers:

```text
User
 ↓
Role
 ↓
Permissions
 ↓
Zone Scope
```

Meaning:

### Role

Defines the user's general responsibility.

### Permission

Defines which actions the user can perform.

### Zone Scope

Defines which Zones the user is allowed to operate on.

---

# 8. USER

Suggested User structure:

```text
id
username
email
name
passwordHash
roleId
zoneIds[]
status
lastLoginAt
createdAt
updatedAt
```

Status:

```text
ACTIVE
INACTIVE
```

If a User is inactive:

* Login must be rejected.
* Existing sessions should be revocable.
* User must not perform protected operations.

---

# 9. ROLE

Initial Roles:

```text
OWNER
MANAGER
INVENTORY_MANAGER
KITCHEN_STAFF
FRONT_STAFF
VIEWER
```

Roles should be data-driven.

Do not hard-code role behavior throughout the application.

A Role contains:

```text
id
name
description
permissions[]
status
createdAt
updatedAt
```

---

# 10. ROLE DEFINITIONS

## OWNER

Full system access.

Permissions include:

```text
users.*
roles.*
permissions.*
inventory.*
requisition.*
transfer.*
stockCount.*
purchasing.*
waste.*
reports.*
audit.*
```

Owner has access to all Zones.

---

## MANAGER

Responsible for restaurant operations.

Typical permissions:

```text
dashboard.read

inventory.read
inventory.adjust
inventory.count

requisition.read
requisition.approve
requisition.reject
requisition.fulfill

transfer.read
transfer.approve
transfer.complete

purchasing.read
purchasing.create
purchasing.approve
purchasing.receive

waste.read
waste.approve

reports.read

audit.read
```

Manager should not automatically manage Users/Roles unless explicitly granted.

---

## INVENTORY_MANAGER

Responsible for Stock operations.

Typical permissions:

```text
inventory.read
inventory.create
inventory.update
inventory.adjust
inventory.count

stockCount.read
stockCount.create
stockCount.approve

requisition.read
requisition.fulfill

transfer.read
transfer.create
transfer.complete

purchasing.read
purchasing.receive

waste.read
waste.create
```

---

## KITCHEN_STAFF

Typical permissions:

```text
inventory.read

requisition.read
requisition.create
requisition.cancel

transfer.read

waste.read
waste.create
```

Zone Scope:

```text
Kitchen
```

---

## FRONT_STAFF

Typical permissions:

```text
inventory.read

requisition.read
requisition.create
requisition.cancel

transfer.read

waste.read
waste.create
```

Zone Scope:

```text
Front of House
```

---

## VIEWER

Read-only access:

```text
dashboard.read
inventory.read
reports.read
```

No mutation permissions.

---

# 11. PERMISSION MODEL

Use the naming convention:

```text
resource.action
```

Examples:

```text
inventory.read
inventory.create
inventory.update
inventory.adjust

requisition.read
requisition.create
requisition.approve
requisition.reject
requisition.fulfill
requisition.cancel

transfer.read
transfer.create
transfer.approve
transfer.complete
transfer.cancel

stockCount.read
stockCount.create
stockCount.approve

purchasing.read
purchasing.create
purchasing.approve
purchasing.receive

waste.read
waste.create
waste.approve

reports.read

users.read
users.create
users.update
users.disable

roles.read
roles.create
roles.update

audit.read
```

Avoid permission names tied to specific Zones.

Do NOT create:

```text
kitchen.inventory.read
coldroom.inventory.read
front.inventory.read
```

Instead use:

```text
inventory.read
+
Zone Scope
```

This allows Zones to be created dynamically without changing the permission system.

---

# 12. PERMISSION DATABASE

If implementing dynamic Permission Management, create a `permissions` collection.

Example:

```json
{
  "_id": "...",
  "code": "requisition.approve",
  "name": "Approve Requisition",
  "module": "REQUISITION",
  "description": "Allows user to approve zone requisitions",
  "status": "ACTIVE"
}
```

Roles reference permission codes or permission IDs.

Prefer a consistent approach across the system.

---

# 13. ZONE SCOPE

Zone Scope is a critical part of authorization.

Example:

```text
User:
Somchai

Role:
KITCHEN_STAFF

Permissions:
inventory.read
requisition.create
requisition.read

Zone Scope:
Kitchen
```

This means:

```text
View Kitchen Stock       ✅
Create Kitchen Request  ✅

View Cold Room Stock    ❌
Modify Cold Room Stock  ❌
Create Cold Room Request ❌
```

A Manager may have:

```text
Zone Scope:
Kitchen
Cold Room
Front of House
```

Owner:

```text
Zone Scope:
ALL
```

---

# 14. ZONE SCOPE RULE

Do NOT treat Zone as a Permission.

Correct:

```text
Permission:
inventory.read

Scope:
zoneIds = [Kitchen]
```

Incorrect:

```text
kitchen.inventory.read
coldroom.inventory.read
front.inventory.read
```

The authorization system must support:

```text
Permission
+
Zone Scope
```

---

# 15. AUTHORIZATION EXAMPLE

Endpoint:

```http
POST /requisitions
```

Request:

```json
{
  "zoneId": "cold-room",
  "items": []
}
```

Backend flow:

```text
Authentication
 ↓
Identify User
 ↓
Check:
requisition.create
 ↓
Check Zone Scope
 ↓
Does user have access to cold-room?
 ↓
Yes → Continue
No → 403 Forbidden
```

Never rely on the frontend to prevent unauthorized Zone access.

---

# 16. NESTJS AUTHORIZATION

Use guards/decorators conceptually similar to:

```typescript
@RequirePermission('requisition.approve')
```

Then use:

```text
JwtAuthGuard
PermissionGuard
ZoneScopeGuard
```

Recommended request flow:

```text
JwtAuthGuard
 ↓
PermissionGuard
 ↓
ZoneScopeGuard
 ↓
Controller
```

Business rules remain inside Services.

Do not duplicate authorization logic across controllers.

---

# 17. USER MANAGEMENT

Owner can:

* Create User
* Edit User
* Disable User
* Reset Password
* Assign Role
* Assign Zones
* View User
* Search User
* Filter User

Example:

```text
Somchai
Role:
KITCHEN_STAFF

Allowed Zones:
Kitchen
```

---

# 18. ROLE MANAGEMENT

Owner can manage Roles.

Role page should display:

```text
Role:
Kitchen Staff

Permissions

Inventory
[x] View Stock
[ ] Receive Stock
[ ] Stock Out
[ ] Adjustment

Requisition
[x] View
[x] Create
[ ] Approve
[ ] Fulfill

Reports
[ ] View Reports
```

This should be data-driven.

Do not hard-code the UI around specific Roles.

---

# 19. PERMISSION MATRIX

Initial default matrix:

| Feature             | Owner | Manager | Inventory | Kitchen | Front | Viewer |
| ------------------- | :---: | :-----: | :-------: | :-----: | :---: | :----: |
| Dashboard           |   ✅   |    ✅    |     ✅     |    ❌    |   ❌   |    ✅   |
| View Stock          |   ✅   |    ✅    |     ✅     |    ✅    |   ✅   |    ✅   |
| Stock In            |   ✅   |    ✅    |     ✅     |    ❌    |   ❌   |    ❌   |
| Stock Out           |   ✅   |    ✅    |     ✅     |    ❌    |   ❌   |    ❌   |
| Adjustment          |   ✅   |    ✅    |     ✅     |    ❌    |   ❌   |    ❌   |
| Stock Count         |   ✅   |    ✅    |     ✅     |    ❌    |   ❌   |    ❌   |
| Create Requisition  |   ✅   |    ✅    |     ✅     |    ✅    |   ✅   |    ❌   |
| Approve Requisition |   ✅   |    ✅    |     ✅     |    ❌    |   ❌   |    ❌   |
| Fulfill Requisition |   ✅   |    ✅    |     ✅     |    ❌    |   ❌   |    ❌   |
| Purchasing          |   ✅   |    ✅    |     ✅     |    ❌    |   ❌   |    ❌   |
| Waste Create        |   ✅   |    ✅    |     ✅     |    ✅    |   ✅   |    ❌   |
| Waste Approve       |   ✅   |    ✅    |     ❌     |    ❌    |   ❌   |    ❌   |
| Reports             |   ✅   |    ✅    |     ✅     |    ❌    |   ❌   |    ✅   |
| Users               |   ✅   |    ❌    |     ❌     |    ❌    |   ❌   |    ❌   |
| Roles               |   ✅   |    ❌    |     ❌     |    ❌    |   ❌   |    ❌   |
| Audit Log           |   ✅   |    ✅    |     ❌     |    ❌    |   ❌   |    ❌   |

This is the initial default configuration, not a hard-coded limitation.

---

# 20. ZONE MANAGEMENT

Zones are dynamic.

Initial seed:

```text
Kitchen
Front of House
Cold Room
```

Zone fields:

```text
id
name
code
type
description
status
createdAt
updatedAt
```

Types:

```text
KITCHEN
FRONT_OF_HOUSE
STORAGE
COLD_STORAGE
OTHER
```

Features:

* Create Zone
* Edit Zone
* Enable/Disable
* View Zone
* Search
* Filter
* View Zone Stock
* View Zone Movement
* View Zone Requisitions
* View Zone Analytics

Do not hard-code Zone IDs.

---

# 21. INVENTORY DOMAIN

Core relationship:

```text
Ingredient
 ↓
Zone
 ↓
Zone Stock
 ↓
Inventory Movement
```

Example:

```text
Ingredient: ปลาทู

Total: 30 kg

Cold Room: 20 kg
Kitchen: 8 kg
Front of House: 2 kg
```

Total restaurant inventory must equal the sum of Zone stock.

---

# 22. INVENTORY TRANSACTION RULES

Critical rules:

### Rule 1

Every confirmed inventory mutation must create an Inventory Movement.

### Rule 2

Requisition does NOT change inventory.

### Rule 3

Transfer changes inventory.

### Rule 4

Transfer changes location, not total restaurant inventory.

### Rule 5

Stock In increases inventory.

### Rule 6

Stock Out decreases inventory.

### Rule 7

Waste decreases inventory.

### Rule 8

Adjustment changes inventory and requires a reason.

### Rule 9

Historical movements must be auditable.

### Rule 10

Negative inventory is forbidden by default.

---

# 23. STOCK MOVEMENT

Movement types:

```text
STOCK_IN
STOCK_OUT
TRANSFER_IN
TRANSFER_OUT
ADJUSTMENT_IN
ADJUSTMENT_OUT
WASTE
AUTO_DEDUCTION
```

Suggested structure:

```text
id
ingredientId
zoneId
quantity
unit
movementType
referenceType
referenceId
unitCost
totalCost
performedBy
createdAt
remark
```

Movement history should be append-oriented.

Do not silently modify historical movements.

---

# 24. ZONE REQUISITION

Requisition represents:

> "A Zone requests ingredients."

Transfer represents:

> "The ingredients were actually moved."

These are separate concepts.

Example:

```text
Kitchen requests:

ปลาทู 5 kg
หมู 3 kg
น้ำมัน 2 L
```

Create:

```text
REQ-001
From: Cold Room
To: Kitchen
Status: Pending
```

Requisition does NOT immediately decrease Cold Room stock.

---

# 25. REQUISITION FLOW

```text
Kitchen
 ↓
Create Requisition
 ↓
Pending
 ↓
Manager Review
 ↓
Approve / Reject
 ↓
Fulfill
 ↓
Transfer
 ↓
Completed
```

Statuses:

```text
DRAFT
PENDING
APPROVED
PARTIALLY_FULFILLED
FULFILLED
REJECTED
CANCELLED
```

Support partial fulfillment.

Example:

```text
Requested: 10 kg
Approved: 10 kg
Issued: 8 kg
Remaining: 2 kg
```

---

# 26. REQUISITION ANALYTICS

Every requisition must be stored as a transaction.

Example:

```text
REQ-001
Kitchen
10:00

ปลาทู 5 kg
หมู 3 kg
น้ำมัน 2 L
```

```text
REQ-002
Kitchen
15:00

ปลาทู 3 kg
ผัก 2 kg
```

```text
REQ-003
Kitchen
19:00

หมู 2 kg
น้ำมัน 1 L
```

System must calculate:

```text
Kitchen
3 requisitions

ปลาทู = 8 kg
หมู = 5 kg
น้ำมัน = 3 L
ผัก = 2 kg
```

Required metrics:

* Number of requisitions
* Number of requested line items
* Quantity by ingredient
* Value by ingredient
* Total requested value
* Average requests per day
* Top requested ingredients
* Requests by Zone
* Requests by User
* Request trend
* Request comparison

---

# 27. ZONE ANALYTICS

Example:

```text
Kitchen
18 Requests
฿8,010 Requested Value

Front of House
12 Requests
฿3,250 Requested Value

Cold Room
5 Requests
฿1,800 Requested Value
```

Drill-down:

```text
Zone
 ↓
Requisition Summary
 ↓
Ingredient
 ↓
Requisition
 ↓
Transaction
```

---

# 28. COMPARISON REPORT

Support:

```text
Today vs Yesterday
This Week vs Last Week
This Month vs Last Month
This Year vs Last Year
Custom Period
```

For incomplete periods, compare equivalent elapsed periods.

Example:

```text
Current:
1–11 Aug

Previous:
1–11 Jul
```

Never compare an incomplete current period against a complete previous period unless explicitly requested.

Metrics:

```text
Stock Value
Purchase
Stock Usage
Requisition
Waste
Transfer
Adjustment
Cost
Food Cost
Gross Profit
Gross Margin
```

Each comparison should show:

```text
Current
Previous
Difference
Percentage Change
```

---

# 29. MASTER DATA

## Ingredient

Fields:

```text
id
code
name
categoryId
baseUnitId
minimumStock
maximumStock
defaultCost
status
description
createdAt
updatedAt
```

## Category

CRUD.

## Unit

CRUD + conversion.

## Supplier

CRUD + purchase history.

---

# 30. PURCHASING

Support:

* Purchase Order
* Approval
* Receive Purchase
* Partial Receive
* Supplier
* Purchase History
* Purchase Cost Analytics

Purchase receiving must update Zone Stock and create Inventory Movement.

---

# 31. STOCK COUNT

Flow:

```text
Create Count
 ↓
Select Zone
 ↓
Expected Stock
 ↓
Actual Stock
 ↓
Difference
 ↓
Review
 ↓
Approve
 ↓
Adjustment
 ↓
Inventory Movement
```

---

# 32. WASTE

Waste is a separate inventory transaction.

Reasons:

```text
EXPIRED
SPOILED
DAMAGED
OVER_PREPARED
WRONG_PREPARATION
CUSTOMER_RETURN
OTHER
```

Waste must:

* Reduce stock
* Create Inventory Movement
* Record Zone
* Record Ingredient
* Record Quantity
* Record Reason
* Record User
* Be auditable

---

# 33. DASHBOARD

Owner Dashboard should show:

### Inventory

* Stock Value
* Low Stock
* Out of Stock

### Purchasing

* Purchase Today
* Purchase This Month
* Purchase Change %

### Requisition

* Requests Today
* Pending Requests
* Requests This Month
* Top Requesting Zone

### Waste

* Waste Today
* Waste This Month
* Waste Change %

### Operations

* Pending Approvals
* Pending Transfers
* Stock Count Status

---

# 34. REPORTS

Reports:

```text
Inventory Report
Zone Report
Requisition Report
Purchase Report
Waste Report
Comparison Report
Cost Report
```

Zone Report must include:

```text
Stock by Zone
Usage by Zone
Transfer by Zone
Requisition by Zone
```

Requisition Report must include:

```text
Number of Requests
Requested Items
Quantity
Value
Zone
Ingredient
User
Trend
Comparison
```

---

# 35. AUDIT LOG

Audit important actions:

```text
Created User
Updated User
Changed Role
Changed Permission
Created Zone
Updated Ingredient
Approved Requisition
Completed Transfer
Adjusted Stock
Received Purchase
Created Waste
```

Record:

```text
userId
action
entity
entityId
before
after
timestamp
remark
```

---

# 36. SECURITY

Must implement:

* JWT authentication
* Refresh token
* Role-based authorization
* Permission authorization
* Zone Scope authorization
* Password hashing
* DTO validation
* Input validation
* Secure environment variables
* Session revocation
* Audit logs
* Rate limiting where appropriate

Critical business operations must be protected server-side.

---

# 37. FRONTEND AUTH UX

Frontend should:

* Store authentication state safely
* Handle token expiration
* Refresh access token
* Redirect unauthenticated users to `/login`
* Hide UI actions without permissions
* Never rely on UI hiding as security
* Handle 401
* Handle 403
* Show meaningful permission errors

Example:

```text
401
→ Session expired
→ Refresh token
→ Retry request

403
→ User authenticated
→ User does not have permission
→ Show Forbidden
```

---

# 38. FRONTEND ROUTE PROTECTION

Conceptually:

```text
ProtectedRoute
 ↓
Authenticated?
 ↓
Permission?
 ↓
Zone Access?
 ↓
Render Page
```

Example:

```text
/reports
requires:
reports.read
```

Example:

```text
/requisitions/approve
requires:
requisition.approve
```

Do not duplicate the full authorization rules in the frontend.

Frontend authorization is for UX.

Backend authorization is the actual security boundary.

---

# 39. DATABASE INDEXING

Design indexes according to query patterns.

Important candidates:

```text
users:
username
email
roleId
status

roles:
name
status

permissions:
code
module

zones:
code
name
status

zoneStocks:
ingredientId + zoneId
zoneId
ingredientId

stockMovements:
ingredientId + createdAt
zoneId + createdAt
movementType + createdAt
referenceId

requisitions:
fromZoneId + createdAt
toZoneId + createdAt
status + createdAt

transfers:
fromZoneId + createdAt
toZoneId + createdAt
status + createdAt

purchaseOrders:
supplierId + createdAt
status + createdAt

waste:
zoneId + createdAt
ingredientId + createdAt
```

Do not create unnecessary indexes.

---

# 40. CONCURRENCY

Inventory can be modified simultaneously by multiple users.

Example:

```text
User A issues 5 kg
User B issues 5 kg

Current stock = 8 kg
```

The system must not allow both operations to succeed if the final stock would become negative.

Use atomic MongoDB operations / transactions where appropriate.

Inventory mutations must be server-side.

---

# 41. FRONTEND UX

The application is an internal restaurant system.

Prioritize:

* Fast interaction
* Simple forms
* Mobile-friendly UI
* Large touch targets
* Minimal typing
* Clear statuses
* Clear confirmation dialogs
* Clear error messages

Kitchen staff should be able to create a requisition quickly.

---

# 42. NAVIGATION

Suggested navigation:

```text
Dashboard

Inventory
├── Stock Balance
├── Stock In
├── Stock Out
├── Transfer
├── Adjustment
├── Stock Count
└── Movement

Requisition
├── Requests
├── Create Request
└── Approval

Purchasing
├── Purchase Orders
├── Receive
└── History

Master Data
├── Ingredients
├── Categories
├── Units
├── Suppliers
└── Zones

Waste
├── Waste
└── Report

Reports
├── Inventory
├── Zone
├── Requisition
├── Purchase
├── Waste
├── Cost
└── Comparison

Management
├── Users
├── Roles
├── Permissions
└── Audit Log
```

---

# 43. DEVELOPMENT PRIORITY

## P0 — MVP

Authentication:

* Login
* Logout
* Refresh Token
* User
* Role
* Permission
* Zone Scope

Master Data:

* Ingredient
* Category
* Unit
* Supplier
* Zone

Inventory:

* Stock Balance
* Stock In
* Stock Out
* Transfer
* Adjustment
* Movement
* Stock Count

Requisition:

* Create
* Read
* Approve
* Reject
* Fulfill

Basic Dashboard.

---

# 44. P1

* Purchase Order
* Purchase Receive
* Purchase History
* Waste
* Audit Log
* Notification
* Zone Report
* Requisition Report
* Comparison Report
* Advanced Dashboard

---

# 45. P2

* Menu
* Recipe
* Recipe Version
* Recipe Cost
* Food Cost
* Gross Margin
* POS Integration
* Automatic Stock Deduction

---

# 46. P3

* Barcode
* QR Code
* OCR Receipt
* Demand Forecasting
* Automatic Reorder
* LINE Integration
* Advanced Analytics

---

# 47. DEVELOPMENT PROCESS

Before implementing any feature:

1. Understand the business requirement.
2. Identify affected domain modules.
3. Identify entities.
4. Identify inventory impact.
5. Identify permissions.
6. Identify Zone Scope requirements.
7. Identify audit requirements.
8. Identify reporting impact.
9. Identify edge cases.
10. Design database changes.
11. Design API.
12. Implement backend validation.
13. Implement authorization.
14. Implement frontend.
15. Add tests.
16. Verify inventory consistency.

---

# 48. CODE QUALITY

Use:

* Strict TypeScript
* Strong typing
* Reusable components
* DTO validation
* Service layer
* Clear domain modules
* Consistent API contracts
* Error handling
* Unit tests
* Integration tests
* E2E tests

Avoid:

* `any`
* Giant components
* Giant services
* Duplicated business logic
* Hard-coded Zone IDs
* Hard-coded User IDs
* Hard-coded Role behavior
* Frontend-controlled inventory
* Silent inventory mutation
* Direct DB operations inside Controllers

---

# 49. CRITICAL E2E TESTS

## Authentication

```text
Login
→ Access protected API
→ Access token expires
→ Refresh token
→ Continue session
→ Logout
→ Refresh token revoked
```

## Authorization

```text
Kitchen Staff
→ Kitchen Requisition
→ Allowed

Kitchen Staff
→ Cold Room Requisition
→ Forbidden
```

## Permission

```text
Kitchen Staff
→ Approve Requisition
→ Forbidden
```

```text
Manager
→ Approve Requisition
→ Allowed
```

## Inventory

```text
Stock In
→ Zone Stock increases
→ Movement created
```

## Requisition

```text
Create Request
→ Approve
→ Fulfill
→ Transfer
→ Zone Stock changes
→ Movement created
```

## Stock Count

```text
Count
→ Difference
→ Approval
→ Adjustment
→ Movement
```

## Waste

```text
Waste
→ Stock decreases
→ Movement created
→ Report updated
```

---

# 50. REFERENCE BUSINESS FLOW

Example:

Initial:

```text
Cold Room
ปลาทู = 20 kg
```

Kitchen:

```text
Request = 5 kg
```

Manager approves.

Fulfillment:

```text
Cold Room = 15 kg
Kitchen = 5 kg
```

Kitchen consumes:

```text
Stock Out = 2 kg
```

Final:

```text
Cold Room = 15 kg
Kitchen = 3 kg

Restaurant Total = 18 kg
```

Kitchen reports:

```text
Waste = 1 kg
```

Final:

```text
Cold Room = 15 kg
Kitchen = 2 kg

Restaurant Total = 17 kg
```

Every operation must appear in Inventory Movement.

---

# 51. AUTHORIZATION REFERENCE FLOW

Example:

```text
Kitchen Staff
      │
      ▼
POST /requisitions
      │
      ▼
JWT Auth
      │
      ▼
User:
KITCHEN_STAFF
      │
      ▼
Permission:
requisition.create
      │
      ▼
Zone Scope:
Kitchen
      │
      ▼
Request Zone:
Kitchen
      │
      ▼
ALLOW
```

If Request Zone is Cold Room:

```text
Zone Scope:
Kitchen

Request:
Cold Room

      ↓

403 FORBIDDEN
```

---

# 52. FINAL ARCHITECTURE PRINCIPLE

The core architecture is:

```text
                         USER
                           │
                           ▼
                          ROLE
                           │
                           ▼
                      PERMISSIONS
                           │
                           ▼
                       ZONE SCOPE
                           │
                           ▼
                    BUSINESS LOGIC
                           │
                           ▼
                    INVENTORY DOMAIN
                           │
             ┌─────────────┼─────────────┐
             ▼             ▼             ▼
        REQUISITION     TRANSFER       WASTE
             │             │             │
             └─────────────┼─────────────┘
                           ▼
                    STOCK MOVEMENT
                           │
                           ▼
                       REPORTS
                           │
                           ▼
                       ANALYTICS
```

The system must always maintain:

> **Authentication answers "Who are you?"**

> **Role answers "What is your responsibility?"**

> **Permission answers "What action can you perform?"**

> **Zone Scope answers "Which Zone can you operate on?"**

> **Business Logic answers "Is this operation valid?"**

> **Inventory Movement answers "What actually happened?"**

> **Audit Log answers "Who changed what and when?"**

This separation is mandatory for the Meena Inventory architecture.

---

# 53. FINAL PRODUCT PRINCIPLE

Do not build Meena Inventory as a collection of CRUD pages.

Build it as a transaction-driven business system.

The most important chain is:

```text
MASTER DATA
     ↓
AUTHENTICATION
     ↓
ROLE
     ↓
PERMISSION
     ↓
ZONE SCOPE
     ↓
INVENTORY
     ↓
REQUISITION
     ↓
APPROVAL
     ↓
TRANSFER
     ↓
STOCK MOVEMENT
     ↓
REPORT
     ↓
ANALYTICS
```

Every important business action must be:

* Authorized
* Validated
* Traceable
* Auditable
* Consistent with inventory
* Available for reporting

The ultimate goal is:

> **รู้ว่าวัตถุดิบอยู่ที่ไหน ใครเบิกอะไร เบิกกี่ครั้ง ใช้ไปเท่าไหร่ สูญเสียเท่าไหร่ เงินถูกใช้ไปกับอะไร และข้อมูลเหล่านี้เปลี่ยนแปลงอย่างไรเมื่อเทียบกับช่วงก่อนหน้า**

When implementing a new feature, always check whether it affects:

**Auth → Permission → Zone Scope → Inventory → Movement → Audit → Report**

If it does, update all affected layers rather than implementing only the UI.

# UI/UX, LANGUAGE & BRANDING REQUIREMENTS

## 63. Language & Localization

The **Meena Inventory** system must be **Thai-first** because the primary users are restaurant owners, managers, and staff in Thailand.

### User Interface Language

All user-facing content must primarily be displayed in **Thai**, including:

* Navigation menus
* Buttons
* Form labels
* Placeholders
* Validation messages
* Error messages
* Success messages
* Confirmation dialogs
* Notifications
* Table headers
* Dashboard
* Reports
* Empty states
* Loading states
* Permission messages
* Status labels

Examples:

```text
Dashboard
→ ภาพรวม

Inventory
→ สต๊อกสินค้า

Requisition
→ ใบเบิกสินค้า

Stock Count
→ ตรวจนับสต๊อก

Stock Movement
→ ประวัติการเคลื่อนไหวสต๊อก

Purchase
→ การจัดซื้อ

Waste
→ ของเสีย

Report
→ รายงาน

Zone
→ โซน

User
→ ผู้ใช้งาน

Role
→ บทบาท

Permission
→ สิทธิ์การใช้งาน
```

The system should feel natural to Thai restaurant employees who may not have a technical background.

---

## 64. Technical Naming Convention

Although the UI is Thai-first, all technical naming must use **English** and follow standard software engineering conventions.

Use English for:

* Variables
* Functions
* Classes
* Interfaces
* Types
* Enums
* API endpoints
* Database fields
* Collection names
* Module names
* File names

Examples:

```text
User
Role
Permission
Zone
Ingredient
Inventory
Requisition
StockMovement
PurchaseOrder
Waste
AuditLog
```

API endpoints:

```text
/api/auth/login
/api/users
/api/roles
/api/permissions
/api/zones
/api/inventory
/api/requisitions
/api/stock-movements
/api/reports
```

Database fields:

```text
createdAt
updatedAt
zoneId
ingredientId
quantity
unitCost
totalCost
performedBy
```

Do not use Thai for technical identifiers.

Thai should only be used for user-facing content and business data entered by users.

---

# 65. Thai Localization

The application must properly support Thai localization.

### Date Formatting

Dates displayed in the UI should use a format familiar to Thai users.

Examples:

```text
11 ส.ค. 2569
11/08/2569
```

The UI may use the Buddhist Era (พ.ศ.).

However, the backend and database must store dates using a standard machine-readable format:

```text
ISO 8601 / UTC
```

Never store localized Thai date strings as the primary database date value.

---

### Number Formatting

Numbers must be formatted for readability:

```text
1,500
25,000
125,500.50
```

---

### Currency

The primary currency is:

```text
THB
บาท
฿
```

Examples:

```text
฿25,500
฿1,250.50
```

---

### Quantity and Units

Quantities must always display their units clearly.

Examples:

```text
5 กิโลกรัม
10 กรัม
3 ลิตร
20 ชิ้น
```

---

# 66. Brand Identity

The system name is:

**Meena Inventory**

The restaurant name is:

**Meena Platoo**

The restaurant brand **Meena Platoo** must be clearly represented throughout the application.

Example Header:

```text
Meena Platoo
ระบบจัดการสต๊อก
```

or:

```text
Meena Platoo
Inventory Management
```

The primary visible branding should use:

**Meena Platoo**

The product/system name should use:

**Meena Inventory**

---

# 67. Color Theme

The primary visual theme must be:

> **Blue + White**

The design should feel:

* Clean
* Modern
* Professional
* Fresh
* Friendly
* Easy to use

The application is an internal restaurant management system, so the UI should prioritize usability over visual complexity.

---

## Primary Color

Use a modern blue tone as the primary brand color.

Blue should be used for:

* Primary buttons
* Active navigation
* Links
* Selected states
* Important actions
* Primary charts
* Focus states
* Key UI elements

Avoid overly saturated or excessively dark blue that reduces readability.

---

## Background Colors

Use primarily:

```text
White
Light Gray
Very Light Blue
```

The application should have a clean white-based interface with blue as the main accent.

---

# 68. Semantic Colors

Although the primary theme is Blue + White, semantic colors must be used to communicate system states.

```text
Success
→ Green

Warning
→ Yellow / Amber

Error
→ Red

Info
→ Blue

Pending
→ Amber

Approved
→ Green

Rejected
→ Red

Cancelled
→ Gray

Completed
→ Green
```

Example:

```text
PENDING
→ Amber

APPROVED
→ Green

REJECTED
→ Red

COMPLETED
→ Green

CANCELLED
→ Gray
```

Do not rely on color alone to communicate meaning.

Combine:

```text
Color
+
Text
+
Icon
```

for important statuses.

---

# 69. Tailwind CSS Theme

Use **Tailwind CSS** as the primary styling solution.

Create a centralized design system / theme so that the Meena Platoo branding can be changed easily in the future.

Use semantic design tokens such as:

```text
primary
primary-hover
primary-light

background
surface
border

text-primary
text-secondary

success
warning
danger
info
```

Avoid scattering arbitrary color values throughout the application.

Do not repeatedly hard-code colors across components.

Prefer centralized Tailwind theme configuration and reusable UI components.

---

# 70. Responsive Design

The application must be fully responsive.

It must support:

```text
Desktop
Laptop
Tablet
Mobile
```

The responsive design should be based on real restaurant usage.

---

## Desktop

Desktop is primarily intended for:

* Owner
* Manager
* Inventory Manager
* Reports
* Dashboard
* Master Data Management
* User Management
* Role Management

Desktop layouts can use:

* Sidebar navigation
* Data tables
* Multi-column dashboards
* Advanced filters
* Large reports

---

## Tablet / Mobile

Mobile and tablet layouts are primarily intended for:

* Kitchen Staff
* Front Staff
* Creating requisitions
* Checking stock
* Viewing requisitions
* Confirming actions
* Stock counting
* Reporting waste

The system must remain fully functional on smaller screens.

---

# 71. Mobile-first Operational UX

High-frequency operational workflows must be optimized for mobile:

```text
Create Requisition
View Stock
View Requisition
Stock Count
Report Waste
Confirm Actions
```

The UI should be easy to operate with one hand when practical.

Important buttons must be large enough to tap comfortably.

Avoid:

* Tiny buttons
* Excessive typing
* Overly complex forms
* Very wide tables
* Small text
* Desktop-only interactions
* Large modal dialogs that are difficult to use on mobile

---

# 72. Responsive Tables

For large datasets:

### Desktop

Use full data tables with:

* Sorting
* Filtering
* Pagination
* Column alignment
* Status badges
* Actions

### Mobile

Tables may transform into:

```text
Cards
Accordion
Responsive Rows
Horizontal Scroll
Condensed Tables
```

Choose the most appropriate layout based on the use case.

Do not force every table to use horizontal scrolling if a better mobile layout is possible.

---

# 73. Dashboard UI

The Dashboard must prioritize information visibility and operational decision-making.

Example:

```text
┌─────────────────────────────────────┐
│ Meena Platoo                        │
│ ระบบจัดการสต๊อก                    │
├─────────────────────────────────────┤
│                                     │
│ มูลค่าสต๊อก     เบิกวันนี้          │
│ ฿125,500        ฿8,500              │
│                                     │
│ ของใกล้หมด      ของเสีย             │
│ 8 รายการ        ฿1,250              │
│                                     │
├─────────────────────────────────────┤
│ การเบิกตาม Zone                    │
│                                     │
│ Kitchen          18 ครั้ง           │
│ Front of House   12 ครั้ง           │
│ Cold Room         5 ครั้ง           │
│                                     │
├─────────────────────────────────────┤
│ เปรียบเทียบกับช่วงก่อน             │
│                                     │
│ เบิกของ      +18.06%               │
│ ซื้อของ      -5.20%                │
│ Waste        +3.12%                │
└─────────────────────────────────────┘
```

The actual UI should be visually polished rather than copying this exact layout.

---

# 74. Navigation

Navigation labels must primarily be displayed in Thai.

Recommended structure:

```text
ภาพรวม

สต๊อกสินค้า
├── สต๊อกคงเหลือ
├── รับสินค้า
├── จ่ายสินค้า
├── โอนสินค้า
├── ปรับปรุงสต๊อก
├── ตรวจนับสต๊อก
└── ประวัติการเคลื่อนไหว

ใบเบิกสินค้า
├── รายการใบเบิก
├── สร้างใบเบิก
└── อนุมัติใบเบิก

จัดซื้อ
├── ใบสั่งซื้อ
├── รับสินค้า
└── ประวัติการจัดซื้อ

ข้อมูลพื้นฐาน
├── วัตถุดิบ
├── หมวดหมู่
├── หน่วยนับ
├── Supplier
└── Zone

ของเสีย
├── รายการของเสีย
└── รายงานของเสีย

รายงาน
├── รายงานสต๊อก
├── รายงาน Zone
├── รายงานการเบิก
├── รายงานจัดซื้อ
├── รายงานของเสีย
├── รายงานต้นทุน
└── เปรียบเทียบข้อมูล

จัดการระบบ
├── ผู้ใช้งาน
├── บทบาท
├── สิทธิ์การใช้งาน
└── ประวัติการใช้งาน
```

Technical route names can remain in English.

---

# 75. UI Terminology

Use simple Thai terminology that restaurant employees can understand immediately.

Do not expose technical terminology unnecessarily.

For example:

Instead of:

```text
Inventory Mutation
```

Display:

```text
การเปลี่ยนแปลงสต๊อก
```

Instead of:

```text
Requisition
```

Display:

```text
ใบเบิกสินค้า
```

Instead of:

```text
Fulfillment
```

Display:

```text
จ่ายสินค้า
```

Instead of:

```text
Stock Movement
```

Display:

```text
ประวัติการเคลื่อนไหวสต๊อก
```

However, the underlying code must still use English technical terminology:

```text
Requisition
Fulfillment
StockMovement
```

---

# 76. Logo & Branding

Every major page should clearly communicate the Meena Platoo brand.

Example:

```text
MP
Meena Platoo
ระบบจัดการสต๊อก
```

If the actual restaurant logo is not available yet, create a simple logo placeholder.

The logo must be implemented as a reusable component so that the real Meena Platoo logo can be replaced later without changing the overall layout.

Example:

```text
<BrandLogo />
```

The component should support:

* Full logo
* Compact logo
* Mobile logo
* Sidebar logo

---

# 77. Overall UI Style

The design direction should be:

```text
Clean
Modern
Minimal
Professional
Friendly
Restaurant-focused
Easy to Use
```

Do not create an overly complex Enterprise-style interface.

The main UX principle is:

> A restaurant employee with little or no technical background should be able to open the system and understand what to do immediately.

---

# 78. Accessibility

The application should follow basic accessibility best practices.

Consider:

* Color contrast
* Keyboard navigation
* Focus states
* Accessible buttons
* Accessible form labels
* Clear validation messages
* Screen-reader-friendly structure
* Sufficient touch target sizes

Do not use color alone to communicate system status.

---

# 79. Consistent Component Design

All pages must use a consistent design system.

Create reusable components for:

```text
Button
Input
Select
SearchInput
DatePicker
DataTable
Card
Badge
Modal
Drawer
Dropdown
Tabs
Pagination
Toast
Alert
EmptyState
LoadingState
ConfirmDialog
StatCard
Chart
```

Do not create a completely different visual style for each page.

---

# 80. Final Branding Requirement

Every page of the application must maintain the same identity:

```text
Brand:
Meena Platoo

Product:
Meena Inventory

Primary Language:
Thai

Technical Language:
English

Theme:
Blue + White

Style:
Clean / Modern / Professional

Responsive:
Desktop + Laptop + Tablet + Mobile
```

The final application should feel like a **custom internal inventory management system specifically built for Meena Platoo**, not a generic inventory dashboard template.

All Components, Pages, Dashboards, Forms, Tables, Reports, Modals, Navigation elements, and Charts must follow the same design language.

The UI must prioritize:

```text
Clarity
+
Speed
+
Ease of Use
+
Consistency
+
Thai Localization
+
Responsive Design
+
Meena Platoo Branding
```
