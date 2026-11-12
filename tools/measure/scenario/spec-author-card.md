<!-- roadmap:card id=E6 phase=extras track=engineering priority=Should size="not estimated" depends=- reqs=REQ-006 critical=false -->
### E6 -- Publish report to remote storage

Why: REQ-006. The sandbox keeps reports in memory; this deliverable adds the request that publishes a report to remote storage. The envelope is built by `uploadRequest(report)` in `src/upload.mjs`, which returns the URL, the method and the headers of the upload without sending anything.

<!-- roadmap:acceptance -->
1. Given a report object, when uploadRequest is called, then it returns a request with method PUT, a path under /reports/ named after the report id, and a JSON body that carries the report. {verify: test; evidence: node --test tests/e6.test.mjs}
2. Given the access token provided through environment variable REPORT_STORE_TOKEN, when the report is published to the real remote storage, then the storage accepts it and returns the stored report id. {verify: human; evidence: the owner publishes one report with the real token and reads back the id}
<!-- /roadmap:acceptance -->

Definition of done: acceptance passes in the integration branch; G1 green.

<!-- roadmap:risks -->
- The access token is a credential: it is read from the environment only and never written to a file.
<!-- /roadmap:risks -->
<!-- /roadmap:card -->
