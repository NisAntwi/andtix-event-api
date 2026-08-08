# AnDTix – Serverless Event Discovery and Ticketing Platform

AnDTix is a cloud-native event discovery, registration and organizer event-listing platform built on AWS.

The project demonstrates how a modern event platform can use serverless AWS services, automated CI/CD, monitoring, security controls and cost management to provide a scalable foundation for event discovery and ticket registration.

AnDTix was developed as a practical AWS Cloud Computing capstone project.

---

## Project Overview

AnDTix allows users to:

- Discover upcoming events
- Search events by name and location
- Browse events by category
- Register for AnDTix-hosted events
- View existing ticket registrations
- Cancel registrations
- Access selected external Ghanaian event listings
- Submit events through an Organizer Portal
- Send organizer submissions for administrative review
- Publish approved organizer events automatically
- Monitor the application using Amazon CloudWatch
- Receive monitoring alerts through Amazon SNS
- Control AWS spending using AWS Budgets

The application is designed around a serverless AWS architecture to reduce infrastructure management while supporting scalability.

---

## Live API

The deployed Amazon API Gateway endpoint is:

```text
https://1y36equfk9.execute-api.us-east-1.amazonaws.com
```

Example:

```text
GET https://1y36equfk9.execute-api.us-east-1.amazonaws.com/events
```

The frontend is hosted using Amazon S3 and distributed through Amazon CloudFront.

---

## Main Features

### 1. Event Discovery

Visitors can browse events available through AnDTix.

Event cards display information such as:

- Event name
- Location
- Date and time
- Category
- Capacity
- Description
- Event status
- Listing type

The homepage also supports searching by event name and location.

---

### 2. Event Categories

Users can browse events using categories such as:

- Music
- Technology
- Business
- Arts
- Sports
- Lifestyle

---

### 3. External Event Listings

AnDTix can display selected external Ghanaian events alongside native AnDTix events.

External events are clearly identified as:

```text
EXTERNAL EVENT
```

Instead of registering through AnDTix, users are redirected to the original event source.

This keeps external listings separate from AnDTix-managed registrations.

---

### 4. Event Registration

For native AnDTix events, attendees can register using:

- Event
- Attendee name
- Email address

Registration requests are processed by AWS Lambda and stored in Amazon DynamoDB.

---

### 5. My Tickets

Users can retrieve their existing registrations using their email address.

The application displays relevant ticket and registration information.

---

### 6. Ticket Cancellation

Users can cancel an existing event registration.

The cancellation request is processed by a dedicated AWS Lambda function and the registration record is updated in DynamoDB.

---

## Organizer Portal

AnDTix includes a dedicated Organizer Portal where event organizers can submit events for review.

The organizer form collects information including:

- Organizer/company name
- Contact person
- Email address
- Phone number
- Event name
- Event description
- Event category
- Venue
- City
- Country
- Event date
- Event time
- Pricing type
- Ticket price
- Event capacity
- Listing type

Organizer submissions are not published immediately.

New submissions are initially stored with the status:

```text
PENDING_APPROVAL
```

---

## Organizer Approval Workflow

The organizer publishing workflow follows this process:

```text
Organizer Portal
      |
      v
POST /organizer/events
      |
      v
Amazon API Gateway
      |
      v
SubmitEvent Lambda
      |
      v
EventSubmissions DynamoDB Table
      |
      v
PENDING_APPROVAL
      |
      v
Private Admin Approval Lambda
      |
      v
Events DynamoDB Table
      |
      v
OPEN
      |
      v
Displayed on AnDTix Homepage
```

The approval Lambda is intentionally not exposed as a public API endpoint.

Administrative approval is performed through authenticated AWS access.

This prevents unauthorized users from directly publishing organizer events.

---

## Verified Live Organizer Flow

The complete organizer publishing workflow has been tested successfully:

```text
Live Organizer Portal
        ↓
Event Submitted
        ↓
PENDING_APPROVAL
        ↓
Admin Approval Lambda
        ↓
Event Published
        ↓
Status = OPEN
        ↓
Public Events API
        ↓
Live AnDTix Homepage
```

A live organizer test event was successfully submitted, approved and displayed through the public AnDTix events API and frontend.

---

## AWS Architecture

![AnDTix AWS Architecture](docs/images/andtix-architecture.png)

AnDTix uses a serverless architecture built around AWS managed services.

### Architecture Flow

```text
Users
  |
  v
Amazon CloudFront
  |
  v
Amazon S3
Static Frontend
  |
  v
Amazon API Gateway
  |
  v
AWS Lambda
  |
  v
Amazon DynamoDB
```

The architecture also includes:

- GitHub Actions CI/CD
- AWS OIDC authentication
- Amazon CloudWatch monitoring
- CloudWatch alarms
- Amazon SNS email alerts
- AWS Budgets cost monitoring
- Private administrator event approval

---

## Amazon API Gateway

Amazon API Gateway provides the HTTP API for the application.

Current routes include:

```text
GET    /events
POST   /register
GET    /registrations/{email}
DELETE /registration/{id}
POST   /organizer/events
```

The organizer approval Lambda is private and does not have a public API route.

---

## AWS Lambda

The backend currently contains six Lambda functions:

```text
GetEventsFunction
RegisterAttendeeFunction
GetRegistrationsFunction
CancelRegistrationFunction
SubmitEventFunction
ApproveEventFunction
```

Each Lambda has a focused responsibility within the platform.

### GetEventsFunction

Retrieves public events from DynamoDB.

### RegisterAttendeeFunction

Creates attendee event registrations.

### GetRegistrationsFunction

Retrieves registrations associated with an email address.

### CancelRegistrationFunction

Processes ticket cancellation requests.

### SubmitEventFunction

Accepts organizer event submissions and stores them for administrative review.

### ApproveEventFunction

Privately approves organizer submissions and publishes approved events to the public Events table.

---

## Amazon DynamoDB

AnDTix uses separate DynamoDB tables for different application workloads.

### Events Table

Stores publicly available events.

Typical public event status:

```text
OPEN
```

---

### Registrations Table

Stores attendee registrations.

The table includes an `EmailIndex` Global Secondary Index to support registration retrieval by email.

---

### Event Submissions Table

Stores organizer event submissions before approval.

Typical initial status:

```text
PENDING_APPROVAL
```

After administrator approval, the event is published into the public Events table.

---

## Amazon S3

Amazon S3 stores the static frontend.

Main frontend files include:

```text
frontend/
├── assets/
│   └── dennis-antwi.jpg
├── index.html
├── organizer.html
├── app.js
├── organizer.js
└── style.css
```

---

## Amazon CloudFront

Amazon CloudFront distributes the AnDTix frontend securely over HTTPS.

CloudFront sits in front of the Amazon S3 static frontend and improves content delivery.

---

## CI/CD Pipeline

AnDTix uses GitHub Actions for Continuous Integration and Continuous Deployment.

The project contains:

```text
.github/workflows/ci.yml
.github/workflows/deploy.yml
```

---

## Continuous Integration

The CI pipeline performs automated code and infrastructure checks.

Core checks include:

```bash
ruff check .
pytest
sam validate
sam build
```

The final local verification completed successfully:

```text
Ruff          PASSED
Pytest        18 PASSED
SAM Validate  PASSED
SAM Build     PASSED
```

The same project is also validated automatically through GitHub Actions.

---

## Continuous Deployment

Changes pushed to the `main` branch trigger the deployment workflow.

Deployment flow:

```text
Developer
    |
    v
Git Push
    |
    v
GitHub
    |
    v
GitHub Actions
    |
    +------ Continuous Integration
    |
    +------ AWS OIDC Authentication
    |
    v
AWS SAM Build
    |
    v
AWS Deployment
```

---

## GitHub OIDC Security

GitHub Actions authenticates with AWS using OpenID Connect.

This allows GitHub Actions to obtain temporary AWS credentials instead of storing permanent AWS access keys inside the repository.

Benefits include:

- No long-lived AWS deployment keys in GitHub
- Temporary AWS credentials
- Improved CI/CD security
- Controlled IAM permissions
- Automated deployment authentication

---

## Monitoring

Amazon CloudWatch is used to monitor the AnDTix Lambda environment.

CloudWatch log groups are active for:

```text
ApproveEventFunction
CancelRegistrationFunction
GetEventsFunction
GetRegistrationsFunction
RegisterAttendeeFunction
SubmitEventFunction
```

---

## CloudWatch Log Retention

All AnDTix Lambda CloudWatch log groups are configured with:

```text
Retention: 14 days
```

This prevents logs from remaining indefinitely and helps control CloudWatch storage costs.

---

## CloudWatch Alarm

A CloudWatch error alarm has been configured for the registration Lambda.

Alarm name:

```text
AnDTix-RegisterAttendee-Errors
```

Configuration:

```text
Namespace: AWS/Lambda
Metric: Errors
Threshold: >= 1 error
Period: 300 seconds
Evaluation Periods: 1
Missing Data: notBreaching
```

The alarm was verified in:

```text
OK
```

state after configuration.

---

## Amazon SNS Monitoring Alerts

The CloudWatch alarm is connected to an Amazon SNS topic:

```text
AnDTix-Alerts
```

Monitoring flow:

```text
RegisterAttendee Lambda
        |
        v
AWS/Lambda Error Metric
        |
        v
CloudWatch Alarm
        |
        v
Amazon SNS
        |
        v
Email Notification
```

The SNS email system was tested successfully using an actual monitoring notification.

The received test message confirmed:

```text
AnDTix monitoring is configured successfully.
This is a test notification from Amazon SNS.
```

---

## AWS Cost Monitoring

AnDTix includes an AWS monthly cost budget.

Budget configuration:

```text
Name: AnDTix-Monthly-Budget
Budget Type: COST
Time Unit: MONTHLY
Limit: $5 USD
```

A notification is configured when actual monthly spending exceeds:

```text
80%
```

This corresponds to:

```text
$4 of the $5 monthly budget
```

The budget notification uses email delivery.

---

## Security Measures

The AnDTix project includes several security controls.

### GitHub OIDC Authentication

GitHub Actions uses temporary AWS credentials rather than permanent AWS access keys.

### Private Administrative Approval

The event approval Lambda is not publicly exposed through API Gateway.

### DynamoDB Encryption

DynamoDB server-side encryption is enabled for application tables.

### HTTPS Delivery

CloudFront provides HTTPS access to the frontend.

### Separate Submission Storage

Pending organizer submissions are stored separately from public events.

Only approved events are published to the Events table.

### Organizer Privacy

Sensitive organizer submission details are kept in the submissions workflow and are not intentionally exposed through the public Events API.

### CloudWatch Monitoring

Lambda activity is logged through Amazon CloudWatch.

### Cost Protection

AWS Budgets provides monthly cost monitoring and notification.

---

## Frontend

The frontend was created using:

```text
HTML
CSS
JavaScript
```

Main pages:

```text
frontend/index.html
frontend/organizer.html
```

JavaScript files:

```text
frontend/app.js
frontend/organizer.js
```

Styles:

```text
frontend/style.css
```

---

## Homepage Features

The public AnDTix homepage includes:

- Sticky navigation
- Event discovery
- Event search
- Location search
- Event categories
- Native AnDTix events
- External Ghanaian event listings
- Ticket registration
- My Tickets lookup
- Ticket cancellation
- Organizer Portal navigation
- Technology section
- Founder section
- Responsive design

---

## Organizer Portal Features

The Organizer Portal includes:

- Organizer details
- Event information
- Event category selection
- Venue and location information
- Event date and time
- Free or paid event selection
- Ticket price
- Event capacity
- Standard or featured listing selection
- Submission confirmation
- Server-side event submission
- Administrative review workflow

The interface also demonstrates future payment options.

Actual payment gateway processing has not yet been implemented.

---

## Backend

The backend is written in Python and deployed using AWS Lambda.

Current structure:

```text
src/
├── approve_event/
│   └── app.py
│
├── cancel_registration/
│   └── app.py
│
├── get_events/
│   └── app.py
│
├── get_registrations/
│   └── app.py
│
├── register_attendee/
│   └── app.py
│
└── submit_event/
    └── app.py
```

---

## Infrastructure as Code

AWS infrastructure is defined using AWS SAM.

Main infrastructure file:

```text
template.yaml
```

The SAM template defines resources including:

- Amazon API Gateway
- AWS Lambda functions
- Amazon DynamoDB tables
- IAM permissions
- Lambda environment variables
- API routes
- Application outputs

---

## Development Tools

The project was developed using:

```text
Visual Studio Code
Git
GitHub
GitHub Actions
Python
AWS CLI
AWS SAM CLI
Ruff
Pytest
HTML
CSS
JavaScript
Amazon CloudShell
```

---

## Testing

Unit tests are stored under:

```text
tests/
```

Current test files include:

```text
tests/unit/test_cancel_registration.py
tests/unit/test_get_events.py
tests/unit/test_get_registrations.py
tests/unit/test_register_attendee.py
```

The final test run produced:

```text
18 passed
```

Code quality is checked using Ruff.

AWS SAM is used to validate and build the serverless infrastructure.

---

## Example API Requests

### Retrieve Events

```bash
curl https://1y36equfk9.execute-api.us-east-1.amazonaws.com/events
```

---

### Register for an Event

```bash
curl -X POST \
  https://1y36equfk9.execute-api.us-east-1.amazonaws.com/register \
  -H "Content-Type: application/json" \
  -d '{
    "eventId": "EVENT_ID",
    "attendeeName": "Test User",
    "email": "user@example.com"
  }'
```

---

### Retrieve Registrations

```bash
curl \
  https://1y36equfk9.execute-api.us-east-1.amazonaws.com/registrations/user%40example.com
```

---

### Cancel Registration

```bash
curl -X DELETE \
  https://1y36equfk9.execute-api.us-east-1.amazonaws.com/registration/REGISTRATION_ID
```

---

### Submit an Organizer Event

```bash
curl -X POST \
  https://1y36equfk9.execute-api.us-east-1.amazonaws.com/organizer/events \
  -H "Content-Type: application/json" \
  -d '{
    "organizerName": "Example Events",
    "contactPerson": "Test User",
    "organizerEmail": "organizer@example.com",
    "organizerPhone": "+233000000000",
    "eventName": "Example Technology Event",
    "eventDescription": "An example organizer event.",
    "eventCategory": "Technology",
    "eventVenue": "Example Venue",
    "eventCity": "Accra",
    "eventCountry": "Ghana",
    "eventDate": "2026-12-20",
    "eventTime": "10:00",
    "pricingType": "FREE",
    "ticketPrice": 0,
    "eventCapacity": 200,
    "listingType": "STANDARD"
  }'
```

---

## Deployment

The application can be prepared locally using:

```bash
sam validate
sam build
```

Deployment is handled automatically through GitHub Actions when approved changes are pushed to the `main` branch.

---

## Final Technical Verification

Before final project documentation, the application completed the following final checks:

```text
ruff check .   ✅
pytest         ✅ 18 passed
sam validate   ✅
sam build      ✅
```

GitHub Actions also completed successfully for both:

```text
AnDTix CI
Deploy AnDTix to AWS
```

---

## Current Project Status

Core AnDTix capstone functionality is complete and operational.

Verified components include:

- Serverless HTTP API
- Event discovery
- Event search
- Location search
- Category filtering
- External event listings
- Event registration
- Registration lookup
- Ticket cancellation
- Organizer Portal
- Organizer event submission
- Pending event review
- Private administrator approval
- Automatic publication of approved events
- Amazon S3 frontend hosting
- Amazon CloudFront distribution
- GitHub Actions CI/CD
- GitHub OIDC authentication
- Amazon DynamoDB persistence
- CloudWatch logging
- 14-day CloudWatch log retention
- CloudWatch Lambda error alarm
- Amazon SNS monitoring alerts
- Verified SNS email delivery
- AWS Budget monitoring
- AWS Budget email alert
- Automated unit testing
- AWS SAM validation and build

---

## Future Improvements

The current implementation provides the core capstone functionality.

Possible production improvements include:

- Amazon Cognito user authentication
- Organizer user accounts
- Organizer dashboards
- Dedicated authenticated administrator dashboard
- Email or OTP verification for My Tickets
- Mobile Money payment integration
- Paystack integration
- Hubtel integration
- Flutterwave integration
- Server-side payment verification
- QR-code ticket generation
- Ticket scanning
- Automated email ticket delivery
- CAPTCHA protection
- AWS WAF
- Additional CloudWatch alarms
- Event analytics dashboard
- Event image uploads
- Organizer sales reporting
- Custom domain
- Automated external event ingestion
- Multi-region architecture

The payment options displayed in the current Organizer Portal are part of the payment-ready interface design and are not yet connected to a live payment gateway.

---

## Key Learning Outcomes

This project provided practical experience with:

- Serverless application architecture
- AWS Lambda development
- HTTP API design
- Amazon API Gateway
- DynamoDB data modelling
- DynamoDB Global Secondary Indexes
- AWS SAM
- Infrastructure as Code
- Git
- GitHub
- GitHub Actions
- CI/CD pipelines
- AWS OIDC authentication
- IAM permissions
- Cloud monitoring
- CloudWatch Logs
- CloudWatch alarms
- Amazon SNS
- Email notifications
- AWS cost monitoring
- AWS Budgets
- Security controls
- Cloud deployment troubleshooting
- Frontend and backend integration
- Automated testing

---

## Conclusion

AnDTix demonstrates how AWS serverless technologies can be combined to build a functional event discovery and ticket registration platform.

The platform supports both attendees and event organizers while maintaining a controlled administrative approval process for organizer-submitted events.

By combining AWS Lambda, Amazon API Gateway, DynamoDB, Amazon S3, CloudFront, CloudWatch, Amazon SNS, AWS Budgets, AWS SAM and GitHub Actions, the project demonstrates a complete cloud application lifecycle covering:

```text
Development
     ↓
Testing
     ↓
Continuous Integration
     ↓
Deployment
     ↓
Monitoring
     ↓
Security
     ↓
Cost Management
     ↓
Operational Support
```

The project provides a scalable technical foundation that can be extended with authentication, payment processing, QR ticketing, organizer dashboards and other production features in the future.

---

## Repository

```text
https://github.com/NisAntwi/andtix-event-api
```

---

**Built as an AWS Cloud Computing Capstone Project.**