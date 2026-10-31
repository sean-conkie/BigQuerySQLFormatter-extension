BigQuery dry runs
================

BigQuery integration is off by default and requires a trusted workspace,
Application Default Credentials and consent. Run
``gcloud auth application-default login`` in the extension host environment,
or configure ``GOOGLE_APPLICATION_CREDENTIALS``. Set
``bigquerySQLFormatter.bigquery.projectId`` if ADC has no default project.
Remote workspaces need credentials on the remote extension host.

Enable ``bigquerySQLFormatter.bigquery.dryRun.enabled`` in VS Code user,
workspace or workspace-folder settings, never ``.bqsqlformatter.json``.
The default ``dryRun.trigger`` is ``onSave``; choose ``onDemand`` for commands
only. Use **BigQuery SQL: Dry Run Current File** or
**BigQuery SQL: Dry Run Selection**. Clicking the status bar runs the current
file again; **BigQuery SQL: BigQuery Actions** offers connection and settings
actions.

Privacy and permissions
-----------------------

Consent identifies the billing project, location and optional quota project.
Query text and configured parameter values are sent to Google's BigQuery
``jobs.insert`` endpoint with ``configuration.dryRun: true`` and
``useLegacySql: false``. Dry runs do not execute queries, create objects or
modify data, are not billed, and are not stored as jobs.
DDL/DML still check write permissions.

The request uses shared ``projectId``, ``location``, ``defaultDataset`` and
``timeoutMs`` settings. Dry runs need ``bigquery.jobs.create`` on the billing
project and access to referenced data/routines; DDL/DML may need more permissions.
``quotaProjectId`` is optional; when set, it needs ``serviceusage.services.use``.
Consent is renewed when project, location or quota project changes.
**BigQuery SQL: Reset BigQuery Consent** cancels pending requests and clears
results. **BigQuery SQL: Retry BigQuery Connection** retries sign-in/consent.
No BigQuery access is allowed in Restricted Mode.

The output channel logs only operation, project, location, duration and status.
It never logs queries, parameter values, schemas, raw API errors or credentials.
Diagnostics can contain query/table names returned by BigQuery and are kept
in memory rather than written to logs.

Diagnostics and estimates
-------------------------

Each run sends the entire document or selection, never separate statements.
This preserves scripts using ``DECLARE``, ``SET``, temporary tables/functions
and ``BEGIN ... END``. BigQuery reports only the first error: **fix and re-run**.
Syntax, schema and permission diagnostics use source ``BigQuery dry run``,
independent of offline linting, ``noqa``, Fix All and the problem limit.
Selection positions map back to the document. Errors without a position
highlight the first matching table path, or the first statement's line.
Configured-location access-denied errors include a location-mismatch hint.

Editing or closing a document clears diagnostics and estimates and cancels
pending work. A new run cancels any older run for that document. Configuration
changes also discard results. Dataform/dbt templates and SQLX config/JS blocks
are skipped, even for selection runs; markers in SQL strings/comments are ignored.

The status bar shows estimated bytes processed and referenced tables in its
tooltip, without historical ``@timestamp`` suffixes. Scripts carry a warning:
statements inside IF/LOOP/BEGIN blocks are not estimated and may report zero.
Estimates are not a billing guarantee. Optional ``dryRun.costPerTiB`` shows an
estimated cost using your own price/currency; unset (or ``null``) hides cost.
There is no built-in price.

Parameters
----------

Undeclared ``@name`` and ``?`` parameters act as untyped NULL. The status bar
adds "parameters assumed NULL; estimate may be low". System variables
(``@@name``), comments and string literals are excluded.

Optionally configure named scalar values:

.. code-block:: json

   {
     "bigquerySQLFormatter.bigquery.dryRun.parameters": {
       "name": { "type": "STRING", "value": "example" },
       "limit": { "type": "INT64", "value": "100" }
     }
   }

A scalar BigQuery type and explicit value are required for every entry.
Use strings for precision-sensitive numbers. An explicit ``null`` is supported;
omitting a value is invalid. ARRAY/STRUCT and declared positional parameters
are not supported. Errors such as ``LIMIT value should not be NULL`` point
to this setting. Parameter values are sent with the query; do not store secrets
in repository settings.
