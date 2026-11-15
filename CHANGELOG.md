# Change Log

All notable changes to the "devprodest-elf-analyzer" extension will be documented in this file.


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