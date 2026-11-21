# Change Log

All notable changes to the "devprodest-elf-analyzer" extension will be documented in this file.


## 0.3.0

### 🚀 New Features
- **External Debug Files Support**: Automatically detects and parses `.gnu_debuglink` sections to load symbols and file paths from external `.debug` files.
- **Universal Toolchain Resolution**: The extension now automatically searches for `llvm-nm`, standard `nm`, and `readelf`, supporting both LLVM and GCC toolchains out of the box.
- **Smart Diff**: The Diff feature now handles renamed symbols and address shifts. It displays both old and new names for modified functions.
- **UI Toggles**: Added settings (`show-charts`, `show-top-15`) to hide the charts or the Top-15 panel for a cleaner workspace.

### 🛠️ UI/UX Improvements
- **Toolchain Settings**: Introduced `toolchain-path` and `prefix` settings. The old `toolchain-nm-bin-path` is now deprecated.
- **Truncated Paths**: File paths in grouped table headers are now truncated to match the main table view.

### 🐛 Bug Fixes
- Replaced the complex Diff scoring with exact-name matching to avoid false positives with duplicate and `OUTLINED_FUNCTION_*` symbols.


## 0.2.0

### 🚀 New Features
- **Top 15 by Section**: The Top-15 panel now dynamically filters to show the largest symbols of the currently selected section.
- **Type Filters**: Added quick segmented controls to filter symbols by type (All, Func, Obj, Other).
- **Collapse/Expand All**: Added a toggle button in the toolbar to collapse or expand all table groups at once.
- **Toolbar Redesign**: Moved the "Hide size=0" toggle out of the search bar into the main toolbar and replaced text buttons with icons for a cleaner look.

### 🛠️ UI/UX Improvements
- Optimized all CSS styles, replacing hardcoded pixels with `rem` units for better scaling.
- Unified button sizes and icon usage across the toolbar, Diff modal, and error screens.
- Added state persistence for the type filter.
- Added active visual states for toggle buttons.


## 0.1.0

### 🚀 New Features
- **Mach-O Support (Experimental)**: Added basic support for macOS/iOS binary formats (`.dylib`, `.macho`). Sizes are approximated by address differences.
- **Table Grouping**: Group symbols by Section or File with collapsible headers and size statistics.
- **Top 15 Symbols**: A quick-view panel showing the largest symbols with click-to-filter functionality.
- **Diff Comparison**: Compare the current binary against a previously saved file to see size changes. Export the diff to CSV or copy it to the clipboard.
- **CSV Export**: Export the currently filtered table (or diff results) to a CSV file.
- **Advanced Filtering**: Added a Regex search toggle and a "Hide size=0" option inside the search bar.
- **State Persistence**: The filter, sorting, grouping, radix (Dec/Hex), and collapsed state are now saved between reloads.

### 🛠️ UI/UX Improvements
- Redesigned the top toolbar to span the full width of the window.
- Replaced the section donut chart with a stack chart that adapts to the window height.
- Added native VSCode color themes to the charts.
- Added adaptive layouts: the Top-15 panel and central statistics hide automatically on narrow screens.
- Improved the search input to look native (with embedded action icons).

### 🐛 Bug Fixes
- Fixed a bug where missing symbols caused the extension to crash or hang indefinitely.
- Fixed sorting logic to correctly handle ascending/descending order and push empty values to the bottom.
- Fixed the regex for section parsing to support sections with dots (e.g., `.text.hot`).
- Replaced `execSync` with asynchronous `execFile` to prevent blocking the VSCode event loop.
- Added robust error handling with a "Retry" button on the error screen.


## 0.0.3
- Fixed a bug when displaying data where the address is empty.


## 0.0.2
- Replaced donut chart with stack chart
- Changed interaction with section charts


## 0.0.1
- Main functions:
    * Getting information about Symbol Names
    * Getting information about symbol sizes
    * Filtering and sorting symbols
    * Estimating the size of symbols and sections