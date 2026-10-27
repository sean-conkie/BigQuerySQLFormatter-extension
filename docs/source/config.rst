=============
Configuration
=============

Formatting
~~~~~~~~~~

Use **Format Document** or **Format Selection** in GoogleSQL language mode.
The extension supplies the default formatter unless you have selected another.
Enable formatting on save in ``settings.json``:

.. code-block:: json

    {
      "[googlesql]": {
        "editor.defaultFormatter": "sean-conkie.bigquerysqlformatter",
        "editor.formatOnSave": true
      }
    }

Formatting repeatedly applies enabled, automatically fixable rules until stable.
It respects editor/project settings and ``noqa``, preserves line endings, and is
independent of the published diagnostic limit. Selection formatting applies only
fixes wholly inside the selection, leaving all other text unchanged. Rules
without automatic fixes remain diagnostics. Formatting uses existing rule
styles, not editor tab/space options. A cycle or more than 100 passes reports an
error without applying partial formatting.

Fix All and fix on save
~~~~~~~~~~~~~~~~~~~~~~~

Fix All combines fixes across the entire document into a single action, even
when only some diagnostics are visible. Like formatting, it repeats safe
non-overlapping fixes until stable, including diagnostics exposed by earlier
fixes. Individual quick fixes are unchanged. Cycles or more than 100 passes
report an error without applying partial fixes.

As an alternative to formatting on save, add this to your ``settings.json``:

.. code-block:: json

    "[googlesql]": {
      "editor.codeActionsOnSave": {
        "source.fixAll.bigquerySQLFormatter": "explicit"
      }
    },

The generic ``"source.fixAll": "explicit"`` setting also includes this extension.

Rule settings
~~~~~~~~~~~~~

All style and best-practice rules default to ``warning``. Configure rules in
VS Code's user, workspace, or workspace-folder ``settings.json``:

.. code-block:: json

    {
      "bigquerySQLFormatter.rules": {
        "CV05": { "enabled": true, "severity": "error" },
        "LT02": { "enabled": false },
        "AL01": { "severity": "hint" },
        "exclude": ["CV01"],
        "groups": { "capitalisation": false }
      }
    }

Rule keys are uppercase codes, including ``RF`` for references. Each rule accepts ``enabled`` (default ``true``
unless its documentation says otherwise)
and ``severity``: ``error``, ``warning``, ``information``, ``hint``, or ``off``.
``off`` disables evaluation and fixes just like ``enabled: false``.
``exclude`` disables the listed codes. ``groups`` accepts boolean toggles for
``aliasing``, ``ambiguous``, ``capitalisation``, ``convention``, ``layout``, ``references``, and
``structure``. An exclusion, a disabled group, or ``severity: off`` takes
precedence over ``enabled: true``.

Rules declared disabled by default require an explicit ``"enabled": true`` in
editor settings or ``.bqsqlformatter.json``. Severity, options, and enabling a
group do not opt a rule in. RF01 is **Disabled by default** because STRUCT
field access can resemble an unknown source qualifier. The other reference
rules are enabled by default; see their individual pages for options.

These controls affect diagnostics, quick fixes, Fix All, and formatting. Disabled rules
do not count toward ``bigquerySQLFormatter.maxNumberOfProblems``.

Rule options
~~~~~~~~~~~~

RF02 requires source-qualified columns in multi-source SELECT scopes.
``ignore_words`` defaults to ``[]``; ``subqueries_ignore_external_references``
defaults to ``false``. Enable the latter to count only local sources in
correlated subqueries. Both options work in editor and project settings.

Rules declare their supported option names, types, allowed values, and defaults.
Set these in a rule's ``options`` object in either VS Code settings or a project
file. The VS Code settings schema offers completion and validation. Currently
CP01 (keywords), CP02 (unquoted identifiers), CP03 (functions), CP04 (literals)
and CP05 (data types) declare
``capitalisation_policy``:

.. code-block:: json

    {
      "bigquerySQLFormatter.rules": {
        "CP04": {
          "options": { "capitalisation_policy": "upper" }
        }
      }
    }

``lower`` (default) requires lowercase tokens; ``upper`` requires
uppercase. ``consistent`` follows the first matching token in the file. A
mixed-case first token selects lowercase. Strings, quoted identifiers, and
comments do not set the policy and are never changed. Options apply to
diagnostics, quick fixes, Fix All, and formatting.

Options are per-rule only; ``groups`` remains a set of boolean toggles and
does not supply shared option defaults. Rules without declared options accept
only an empty ``options`` object.

Option declarations also support string lists, represented in the settings
schema as ``{"type": "array", "items": {"type": "string"}}``. Every element
must be a string; empty lists are valid. RF04 uses ``ignore_words`` for
case-insensitive exceptions. Its ``unquoted_identifiers_policy`` defaults to
``aliases`` and ``quoted_identifiers_policy`` defaults to ``none``; both support
``aliases``, ``column_aliases``, ``table_aliases`` and ``all``. Quoted identifiers
also support ``none``. The same options work in project configuration files.

RF05 checks quoted identifiers with ``quoted_identifiers_policy`` (default
``all``), ``allow_space_in_identifier`` (default ``false``),
``additional_allowed_characters`` (default ``[]``) and ``ignore_words``
(default ``[]``). Characters are treated literally, not as regular expressions.

RF06 removes unnecessary identifier backticks. ``check_table_paths`` defaults
to ``false`` to preserve deliberate full-path quoting, and ``ignore_words``
defaults to ``[]``. Quick fixes preserve text inside the backticks; CP02 may
re-case newly unquoted case-insensitive identifiers on a subsequent pass.

Project configuration
~~~~~~~~~~~~~~~~~~~~~

Create ``.bqsqlformatter.json`` in your workspace:

.. code-block:: json

    {
      "maxNumberOfProblems": 100,
      "rules": {
        "CV05": { "severity": "error" },
        "LT02": { "enabled": false },
        "exclude": ["CV01"],
        "groups": { "capitalisation": false }
      }
    }

The server uses the nearest config file from the SQL file's directory up to its
workspace-folder root. Nested workspace roots are isolated, and parent configs
outside the workspace are not read. Without a workspace, only the SQL file's
own directory is checked. Non-file documents do not load project configuration.
Only the nearest config is used; project configs do not inherit from each other.

Project values override VS Code settings field by field, including individual
rule fields, individual ``options`` fields, and group toggles. ``exclude``
replaces the editor's exclusion list; use ``[]`` to clear it. Omitted fields
retain their editor values. The problem limit must be a non-negative integer.
String-list options replace the corresponding editor list rather than extending
it. An empty list clears an inherited list, while an omitted option retains it.

Creating, editing, or deleting a config file in the workspace immediately
revalidates open SQL files, as do VS Code setting changes. Invalid JSON, invalid
rule settings, and unreadable configs report errors rather than silently
falling back to another configuration.

Unknown options, invalid option types/values, or a non-object ``options`` value
produce the same visible configuration error, but reset only that rule's entire
options object to its declared defaults. This also overrides inherited editor
option values; other valid settings remain active. An empty ``options`` object
retains inherited editor values.

Other style options (indentation, comma position and quotes) and ``.sqlfluff``
compatibility are not currently supported.

Disable rules in SQL
~~~~~~~~~~~~~~~~~~~~

In-line directive
-----------------

To disable all rules for a line add comment ``-- noqa``.

.. code-block:: sql

    select case when cc.enddate is null then 1 else null end as is_current -- noqa
      from dataset.table cc;
    

To disable specific rules for a line add comment ``-- noqa`` followed by a comma separated list of rules.

.. code-block:: sql

    select case when cc.enddate is null then 1 else null end as is_current -- noqa: ST01
      from dataset.table cc;

File and region directives
--------------------------

Use ``disable=`` to suppress rules from that line onward and ``enable=`` to
restore them. Put a disable directive at the top to suppress rules throughout
the file. Codes are comma-separated and case-insensitive; ``all`` matches all
rules. Directives are read only from SQL line comments, not strings or block
comments.

.. code-block:: sql

    -- noqa: disable=CV05, LT02
    select a = null
    from dataset.table;
    -- noqa: enable=CV05
    select b = null;
    -- noqa: enable=all

The most recent matching disable/enable directive wins. For example,
``disable=all`` followed by ``enable=CV05`` restores only CV05. An enable
directive cannot re-enable rules disabled in configuration. Existing line-only
``-- noqa`` and ``-- noqa: CODE`` suppression continues to work.
