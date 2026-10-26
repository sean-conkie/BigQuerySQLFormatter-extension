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
~~~~~~~~~~~~~~~~~~~~~~

Fix All combines non-overlapping fixes across the entire document into a single
action, even when only some diagnostics are visible. Individual quick fixes are
unchanged. Overlapping fixes can require another invocation; formatting repeats
fixes automatically.

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

Rule keys are uppercase codes. Each rule accepts ``enabled`` (default ``true``)
and ``severity``: ``error``, ``warning``, ``information``, ``hint``, or ``off``.
``off`` disables evaluation and fixes just like ``enabled: false``.
``exclude`` disables the listed codes. ``groups`` accepts boolean toggles for
``aliasing``, ``ambiguous``, ``capitalisation``, ``convention``, ``layout``, and
``structure``. An exclusion, a disabled group, or ``severity: off`` takes
precedence over ``enabled: true``.

These controls affect diagnostics, quick fixes, Fix All, and formatting. Disabled rules
do not count toward ``bigquerySQLFormatter.maxNumberOfProblems``.

Rule options
~~~~~~~~~~~~

Rules declare their supported option names, types, allowed values, and defaults.
Set these in a rule's ``options`` object in either VS Code settings or a project
file. The VS Code settings schema offers completion and validation. Currently
CP01 (keywords) and CP04 (literals) declare ``capitalisation_policy``:

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
