import { CompletionItem, CompletionItemKind, InsertTextFormat, InsertTextMode } from 'vscode-languageserver/node';

export const geographyFunctions: CompletionItem[] = [{
  label: 'st_geogpoint',
  labelDetails: { detail: '(longitude, latitude)', description: undefined },
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(longitude, latitude) -> GEOGRAPHY',
  documentation: {
    kind: 'markdown',
    value: 'Creates a GEOGRAPHY with a single point.'
  },
  insertText: 'st_geogpoint(${1:longitude}, ${2:latitude})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'st_geogpoint(longitude, latitude)'
},
{
  label: 'st_makeline',
  labelDetails: {
    detail: '(geography_1, geography_2)',
    description: undefined
  },
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(geography_1, geography_2) -> GEOGRAPHY',
  documentation: {
    kind: 'markdown',
    value: 'Creates a GEOGRAPHY with a single linestring by concatenating input GEOGRAPHY values.'
  },
  insertText: 'st_makeline(${1:geography_1}, ${2:geography_2})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'st_makeline(geography_1, geography_2)'
},
{
  label: 'st_makepolygon',
  labelDetails: {
    detail: '(polygon_shell[, array_of_polygon_holes])',
    description: undefined
  },
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(polygon_shell[, array_of_polygon_holes]) -> GEOGRAPHY',
  documentation: {
    kind: 'markdown',
    value: 'Creates a GEOGRAPHY containing a single polygon from linestring inputs.'
  },
  insertText: 'st_makepolygon(${1:polygon_shell}${2:,[ ${3:array_of_polygon_holes}]}$0)',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'st_makepolygon(polygon_shell[, array_of_polygon_holes])'
},
{
  label: 'st_makepolygonoriented',
  labelDetails: { detail: '(array_of_geography)', description: undefined },
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(array_of_geography) -> GEOGRAPHY',
  documentation: {
    kind: 'markdown',
    value: 'Constructs a GEOGRAPHY with a single polygon, using the orientation of the input vertices.'
  },
  insertText: 'st_makepolygonoriented(${1:array_of_geography})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'st_makepolygonoriented(array_of_geography)'
},
{
  label: 'st_geogfrom',
  labelDetails: { detail: '(expression)', description: undefined },
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(expression) -> GEOGRAPHY',
  documentation: {
    kind: 'markdown',
    value: 'Converts an expression into a GEOGRAPHY value.'
  },
  insertText: 'st_geogfrom(${1:expression})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'st_geogfrom(expression)'
},
{
  label: 'st_geogfromgeojson',
  labelDetails: {
    detail: '(geojson_string[, make_valid => constant_expression])',
    description: undefined
  },
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(geojson_string[, make_valid => constant_expression]) -> GEOGRAPHY',
  documentation: {
    kind: 'markdown',
    value: 'Returns a GEOGRAPHY value that corresponds to a GeoJSON representation.'
  },
  insertText: 'st_geogfromgeojson(${1:geojson_string}${2:,[ make_valid => ${3:constant_expression}]}$0)',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'st_geogfromgeojson(geojson_string[, make_valid => constant_expression])'
},
{
  label: 'st_geogfromtext',
  labelDetails: {
    detail: '(wkt_string[, oriented => value])',
    description: undefined
  },
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(wkt_string[, oriented => value]) -> GEOGRAPHY',
  documentation: {
    kind: 'markdown',
    value: 'Converts a WKT geometry value into a GEOGRAPHY value.'
  },
  insertText: 'st_geogfromtext(${1:wkt_string}${2:,[ oriented => ${3:value}]}$0)',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'st_geogfromtext(wkt_string[, oriented => value])'
},
{
  label: 'st_geogfromwkb',
  labelDetails: {
    detail: '(wkb_bytes_expression[, oriented => value])',
    description: undefined
  },
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(wkb_bytes_expression[, oriented => value]) -> GEOGRAPHY',
  documentation: {
    kind: 'markdown',
    value: 'Converts an expression in WKB format into a GEOGRAPHY value.'
  },
  insertText: 'st_geogfromwkb(${1:wkb_bytes_expression}${2:,[ oriented => ${3:value}]}$0)',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'st_geogfromwkb(wkb_bytes_expression[, oriented => value])'
},
{
  label: 'st_geogpointfromgeohash',
  labelDetails: { detail: '(geohash)', description: undefined },
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(geohash) -> GEOGRAPHY',
  documentation: {
    kind: 'markdown',
    value: 'Returns a GEOGRAPHY value corresponding to a point in a GeoHash.'
  },
  insertText: 'st_geogpointfromgeohash(${1:geohash})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'st_geogpointfromgeohash(geohash)'
},
{
  label: 'st_geohash',
  labelDetails: {
    detail: '(geography_expression[, maxchars])',
    description: undefined
  },
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(geography_expression[, maxchars]) -> STRING',
  documentation: {
    kind: 'markdown',
    value: 'Takes a single-point GEOGRAPHY and returns a GeoHash representation.'
  },
  insertText: 'st_geohash(${1:geography_expression}${2:,[ ${3:maxchars}]}$0)',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'st_geohash(geography_expression[, maxchars])'
}];