const express = require("express");
const fs = require("fs");
const csv = require("csv-parser");
const path = require("path");

const app = express();
const port = 3000;

let companies = [];
let relationships = [];

// Helper function to load CSV data
function loadCSVData(filePath, dataArray, callback) {
	fs.createReadStream(filePath)
		.pipe(csv())
		.on("data", (row) => {
			// Convert numeric strings to numbers
			if (row.id) row.id = parseInt(row.id);
			if (row.source_company_id)
				row.source_company_id = parseInt(row.source_company_id);
			if (row.target_company_id)
				row.target_company_id = parseInt(row.target_company_id);
			if (row.strength) row.strength = parseFloat(row.strength);
			dataArray.push(row);
		})
		.on("end", () => {
			console.log(
				`${path.basename(filePath)} CSV file successfully processed`
			);
			if (callback) callback();
		});
}

// Load all data when the server starts
loadCSVData(path.join(__dirname, "data/companies.csv"), companies, () => {
	loadCSVData(
		path.join(__dirname, "data/relationships.csv"),
		relationships,
		() => {
			console.log("All data loaded and server ready.");
		}
	);
});
// Serve static files (HTML, CSS, frontend JS) from a 'public' directory
app.use(express.static(path.join(__dirname, "Frontend")));
//server threejs as 'three'
app.use(
	"/three",
	express.static(path.join(__dirname, "../node_modules/three/"))
);
// API endpoint to get company graph data
app.get("/api/company/:companyId/graph", (req, res) => {
	const focusCompanyId = parseInt(req.params.companyId);
	console.log("Focus company ID:", focusCompanyId);
	if (isNaN(focusCompanyId)) {
		return res.status(400).json({ error: "Invalid company ID" });
	}

	const focusCompany = companies.find((c) => c.id === focusCompanyId);
	if (!focusCompany) {
		return res.status(404).json({ error: "Company not found" });
	}

	const relatedEntries = relationships
		.filter(
			(r) =>
				r.source_company_id === focusCompanyId ||
				r.target_company_id === focusCompanyId
		)
		.map((r) => {
			let relatedCompanyId;
			let relationshipToFocus; // Describes the relationship from the related company TO the focus company

			if (r.source_company_id === focusCompanyId) {
				relatedCompanyId = r.target_company_id;
				relationshipToFocus = r.relationship_type; // The type as defined from focus to target
			} else {
				relatedCompanyId = r.source_company_id;
				// Attempt to find the reciprocal relationship type or use the existing one
				// This is a simplification; you might have specific logic for this
				const reciprocal = relationships.find(
					(rel) =>
						rel.source_company_id === relatedCompanyId &&
						rel.target_company_id === focusCompanyId &&
						rel.relationship_type !== r.relationship_type
				);
				relationshipToFocus = reciprocal
					? reciprocal.relationship_type
					: r.relationship_type;
			}

			const relatedCompany = companies.find(
				(c) => c.id === relatedCompanyId
			);

			return {
				...r, // Includes original relationship details like strength, details
				relationship_with_focus: r.relationship_type, // Type from focus to this related company
				related_company_details: relatedCompany,
			};
		});

	res.json({
		focus_company: focusCompany,
		related_companies: relatedEntries,
	});
});

app.listen(port, () => {
	console.log(`Server running at http://localhost:${port}`);
});
