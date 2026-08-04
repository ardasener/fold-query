# page-tiling Specification

## Purpose

Lay out the unfolded net into pages of the usable sheet area: atomic islands at true mm scale, deterministic multi-page packing, overflow warnings for oversized islands, and a page-based preview.

## Requirements

### Requirement: Page-based tiling
The system SHALL lay out the unfolded net into pages of the usable sheet area (paper size minus a fixed 10mm margin on each side) using the greedy row-wrap packer, producing a deterministic list of pages.

#### Scenario: Net fits one page
- **WHEN** all islands fit within the usable area of a single sheet
- **THEN** the layout produces exactly one page containing all islands

#### Scenario: Net overflows to multiple pages
- **WHEN** the islands do not fit within one sheet
- **THEN** the layout produces additional pages, with islands packed into pages in descending face count order

#### Scenario: Deterministic output
- **WHEN** the same net and paper size are laid out twice
- **THEN** the resulting pages and island placements are identical

### Requirement: Islands are atomic
The system SHALL NOT scale or split islands when laying out or printing; every island appears on exactly one page at its true mm size.

#### Scenario: Island not scaled
- **WHEN** an island is placed on a page
- **THEN** its on-page coordinates are its true mm coordinates (1 unit = 1mm), never scaled

#### Scenario: Island not split across pages
- **WHEN** an island is placed on a page
- **THEN** the entire island is on that single page, and no part of it appears on another page

### Requirement: Overflow warning
The system SHALL detect islands whose bounding box exceeds the usable page area and surface a warning.

#### Scenario: Oversized island warned
- **WHEN** an island's bounding box is larger than the usable page area in width or height
- **THEN** the preview displays a warning naming the island, and the island is shown at 1:1 running off the page

### Requirement: Page preview
The Print Preview SHALL render all pages stacked vertically, each with a visible page boundary and a page number label, scaled only for on-screen display.

#### Scenario: Multiple pages visible
- **WHEN** the layout produces multiple pages
- **THEN** the preview shows every page with its page number and a distinct page boundary

#### Scenario: Screen scaling does not affect print
- **WHEN** the preview is scaled to fit the pane
- **THEN** the print output still uses true mm coordinates
