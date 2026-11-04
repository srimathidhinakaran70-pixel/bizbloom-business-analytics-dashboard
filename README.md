# BizBloom — Business Analytics & Performance Dashboard

BizBloom is a responsive, client-side business intelligence dashboard built with HTML5, CSS3, vanilla JavaScript and Chart.js. It is designed as a beginner-friendly Data Analytics internship project.

## Files

- `index.html` — semantic page structure, dashboard sections and controls.
- `style.css` — pink/lavender design system, responsive layouts, animations and print styles.
- `script.js` — CSV parsing/validation, calculations, filtering, charts, insights, table and exports.
- `sample-data.csv` — 36 fictional business sales records.
- `README.md` — setup and usage guide.

## Run locally

1. Download or extract all five files into the same folder.
2. Open a terminal in that folder and start a local static server. For example, with Python:
   ```bash
   python -m http.server 8000
   ```
3. Visit `http://localhost:8000` in your browser.

A local server is recommended because browsers may block `fetch()` when an HTML file is opened directly using `file://`. Chart.js is loaded from jsDelivr, so an internet connection is required for charts. The dashboard and data processing run in your browser; no external database or backend is connected.

## Features

- Seven live KPIs: revenue, expenses, net profit, orders, unique customers, average order value and profit margin.
- Interactive Chart.js visualizations: monthly revenue, product sales, regional revenue, monthly profit and customer purchase distribution.
- Customer snapshot, repeat-purchase classification and top-customer ranking.
- Date/month, product, category and region filters that update every KPI, chart and insight.
- Upload a custom CSV, validate required fields and calculations, and skip invalid rows with a validation message.
- Search, sort and paginate the records table.
- Export filtered records and a business summary to CSV.
- Download the sample CSV, print a report, and download each chart as a PNG using its **↓ PNG** button.
- Responsive desktop, tablet and mobile navigation and layouts.

## CSV format

The uploaded CSV must contain these columns (header matching is case-insensitive; common aliases such as `Date`, `Customer`, `Qty`, `Price` and `Sales` are accepted):

`Order ID, Order Date, Customer Name, Product, Category, Region, Quantity, Unit Price, Revenue, Expenses, Profit`

Validation rules:
- Required text fields and a parseable order date must be present.
- Quantity must be greater than zero; unit price, revenue and expenses must not be negative.
- Revenue must equal `Quantity × Unit Price` (within 0.02 to allow rounding).
- Profit must equal `Revenue − Expenses` (within 0.02).
- Invalid rows are skipped and reported. A file with no valid rows is rejected.

Dates should be in a browser-parseable format such as `YYYY-MM-DD`. Use consistent decimal notation and comma-separated values; quoted CSV fields containing commas are supported.

## Calculation notes

- Revenue, expenses and profit are summed from valid order records.
- Average order value = total revenue / number of records (orders).
- Profit margin = total profit / total revenue × 100.
- Customers are unique customer names in the current filtered data.
- New customer means their first-ever purchase in the currently loaded dataset appears in the current filtered selection. Returning customers are those whose first purchase is outside the selected records but who have purchases in the selection. This classification uses the full loaded dataset, even when dashboard filters are active.
- Sales growth compares the latest available month with the immediately preceding month in the filtered data. It is unavailable if there is no prior month.
- Product improvement insight flags a negative-profit product, otherwise identifies the lowest-profit product for review.

## Privacy

Uploaded files are parsed locally in the browser and are not transmitted to a server. This implementation does not use localStorage and does not persist uploaded data after the page is closed or refreshed.
