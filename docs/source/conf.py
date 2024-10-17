# Configuration file for the Sphinx documentation builder.
import json
from pathlib import Path

# -- Project information

project = "BigQuery SQL Formatter"
copyright = "2024, sean-conkie"
author = "sean-conkie"


release = "0.1"
version = "0.0.5"

# find the package.json at the project root
package_json = Path(__file__).parents[2] / "package.json"
if package_json.exists():
    with package_json.open() as f:
        package = json.load(f)
        release = package["version"]
        version = release.split("-")[0]

# -- General configuration

extensions = [
    "sphinx.ext.duration",
    "sphinx.ext.doctest",
    "sphinx.ext.autodoc",
    "sphinx.ext.autosummary",
    "sphinx.ext.intersphinx",
]

intersphinx_mapping = {
    "python": ("https://docs.python.org/3/", None),
    "sphinx": ("https://www.sphinx-doc.org/en/master/", None),
}
intersphinx_disabled_domains = ["std"]

templates_path = ["_templates"]

# -- Options for HTML output

html_theme = "sphinx_rtd_theme"

# -- Options for EPUB output
epub_show_urls = "footnote"
