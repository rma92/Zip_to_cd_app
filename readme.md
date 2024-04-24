# Zip to CD
Converts a zip code to a congressional district(s).

Note that this only works with physical residential zip code, as it is only intended to look up who represents a particular voter.  It is implemented using the Zip Code Tabulation Areas from the US Census, which generally lines up to zip codes, but only where people actually live.  In locations where there are only businesses, or no one lives for some other reason, data does not exist or may be inaccurate.  Therfore, not all zip codes are present, but any zip code where a person has a house should exist.

This application replicates the functionality of this page on house.gov: https://www.house.gov/representatives/find-your-representative

# Set up
```
set path=%PATH%;C:\local\spatialite-tools-5.1.0a-win-amd64
spatialite tiger.db
```
In the database, do the following.
```
pragma synchronous = off;
pragma count_changes = false;
pragma journal_mode = off;
pragma temp_store = memory;
.loadshp C:\\gisdata\\www2.census.gov\\geo\\tiger\\TIGER_RD18\\LAYER\\CD\\tl_2022_us_cd116 cd utf-8
.loadshp C:\\gisdata\\www2.census.gov\\geo\\tiger\\TIGER_RD18\\LAYER\\ZCTA520\\tl_2022_us_zcta520 zcta utf-8
.loadshp C:\\gisdata\\www2.census.gov\\geo\\tiger\\TIGER_RD18\\LAYER\\STATE\\tl_rd22_us_state state utf-8
```
(these aren't used yet):
```
.loadshp C:\\gisdata\\www2.census.gov\\geo\\tiger\\TIGER_RD18\\LAYER\\PLACE\\tl_rd22_40_place place utf-8
.loadshp C:\\gisdata\\www2.census.gov\\geo\\tiger\\TIGER_RD18\\LAYER\\COUNTY\\tl_rd22_us_county county utf-8
```
Census FTP Info: https://www.census.gov/programs-surveys/acs/data/data-via-ftp.html

# Basic Algorithm
ZCTA to congress algorithm
From Tiger,
Load ZCTA
Load COUNTY

User enter ZCTA.
Attempt to do ST_INTERSECTS of the ZCTA over the congressional district.

If there is not congressional district, guess based on the first 4, then first 3, then first 2 digits of zip code. If that doesn't work, fail.

# Implementation/Preparation
The zip code name is stored in the zcta table in the zcta5ce20 column:
`select * from zcta where zcta5ce20 = '33131';`
A query:
```
SELECT * FROM cd AS cd, (SELECT geometry FROM zcta WHERE zcta5ce20 = '33131') AS z WHERE st_intersects(cd.geometry, z.geometry);
```
Another query:
```
SELECT CD.statefp, CD.cd116fp
FROM CD
JOIN ZCTA ON ST_Intersects(CD.geometry, ZCTA.geometry)
WHERE ZCTA.zcta5ce20 = '33131';
```
Set up a spatial index and use it:
```
SELECT CreateSpatialIndex('CD', 'geometry');
CREATE INDEX zcta_zcta5ce20 ON zcta(zcta5ce20);
SELECT ROWID FROM SpatialIndex WHERE f_table_name = 'CD' AND f_geometry_column = 'geometry' AND search_frame = (SELECT geometry FROM zcta WHERE zcta5ce20 = '33131');

SELECT * FROM CD WHERE ST_Intersects(CD.geometry, (SELECT geometry FROM zcta WHERE zcta5ce20 = '33131')) AND ROWID IN
(
SELECT ROWID FROM SpatialIndex WHERE f_table_name = 'CD' AND f_geometry_column = 'geometry' AND search_frame = (SELECT geometry FROM zcta WHERE zcta5ce20 = '33131')
);
```
Use the index to show the state name, and the CD number:
```
SELECT zip, stusps, cd116fp FROM CD, state, (SELECT zcta5ce20 AS zip, geometry AS g FROM zcta WHERE zcta5ce20 = '33131') AS zg WHERE ST_Intersects(CD.geometry, zg.g )
AND cd.statefp = state.statefp
AND CD.ROWID IN
(SELECT ROWID FROM SpatialIndex WHERE f_table_name = 'CD' AND f_geometry_column = 'geometry' AND search_frame = zg.g);
```
And with a GeoJSON:
```
SELECT zip, stusps, cd116fp, AsGeoJSON(Simplify(cd.geometry, 0.001), 3) FROM CD, state, (SELECT zcta5ce20 AS zip, geometry AS g FROM zcta WHERE zcta5ce20 = '33131') AS zg WHERE ST_Intersects(CD.geometry, zg.g )
AND cd.statefp = state.statefp
AND CD.ROWID IN
(SELECT ROWID FROM SpatialIndex WHERE f_table_name = 'CD' AND f_geometry_column = 'geometry' AND search_frame = zg.g);
```
**Create a ZipToCD table that's precomputed and doesn't require spatial processing** (this took about a minute on an i7-11th gen laptop).
```
CREATE TABLE ZipToCD AS
SELECT zip, stusps, cd116fp FROM CD, state, (SELECT zcta5ce20 AS zip, geometry AS g FROM zcta WHERE zcta5ce20 IN (SELECT DISTINCT ZCTA5CE20 FROM ZCTA)) AS zg WHERE ST_Intersects(CD.geometry, zg.g )
AND cd.statefp = state.statefp
AND CD.ROWID IN
(SELECT ROWID FROM SpatialIndex WHERE f_table_name = 'CD' AND f_geometry_column = 'geometry' AND search_frame = zg.g);
```
Export the table
```
.mode csv
.headers on
.output ziptocd.csv
select * from ZipToCD;
.output stdout
.mode list
```
# Find representative by district
This data set may be useful: https://github.com/unitedstates/congress-legislators

legislators-current.csv contains all members of congress.  To get only representatives, select by state and district.

### house.gov
Go to: https://www.house.gov/representatives
Select the table, paste into VIM.  The table data will be in TSV (tab-separated value) format.  There is likely an easier to use source of this information.

You can ask chatGPT to format this if needed.

### wikipedia (includes pictures)
Go to: https://en.wikipedia.org/wiki/List_of_current_members_of_the_United_States_House_of_Representatives
Select the table, paste into Excel.  Parsing this may be slightly inconvenient.

