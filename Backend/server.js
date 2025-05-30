const express = require("express");
// const fs = require("fs"); // No longer needed for CSV loading
// const csv = require("csv-parser"); // No longer needed for CSV loading
const path = require("path");
const db = require("./database"); // Import your database module

const app = express();
const port = 3000;
app.use(express.json()); // Good, this is necessary for req.body

// Initialize the database when the server starts
async function initializeDatabase() {
	try {
		await db.initDb(); // This creates/updates tables as per your database.js
		console.log("Database initialized successfully.");
	} catch (err) {
		console.error("Failed to initialize database:", err);
		process.exit(1);
	}
}

// Serve static files
app.use(express.static(path.join(__dirname, "Frontend")));
app.use(
	"/three",
	(req, res, next) => {
		// console.log(`Serving /three static file: ${req.url}`); // Can be verbose, optional
		next();
	},
	express.static(path.join(__dirname, "../node_modules/three/"))
);

// Endpoint to get company names and IDs (for dropdowns, etc.)
// In server.js
app.get("/api/company/getCompanyNamesAndIds", async (req, res) => {
	try {
		const companyList = await db.getCompanyIdAndNameList(); // Use the new optimized function
		res.json(companyList);
	} catch (error) {
		console.error("Error fetching company names and IDs:", error);
		res.status(500).json({ error: "Internal server error" });
	}
});

// API Endpoint for Graph Data
app.get("/api/company/:companyId/graph", async (req, res) => {
	const focusCompanyId = parseInt(req.params.companyId);
	if (isNaN(focusCompanyId)) {
		return res.status(400).json({ error: "Invalid company ID" });
	}

	try {
		const focusCompany = await db.getCompanyById(focusCompanyId);
		if (!focusCompany) {
			return res.status(404).json({ error: "Company not found" });
		}
		// focusCompany will now contain all the new fields from the expanded schema.
		// Your frontend needs to be aware if it wants to use/display these.

		const directRelationships = await db.getRelationshipsForCompany(focusCompanyId);

		const relatedCompanyEntries = await Promise.all(
			directRelationships.map(async (r) => {
				let relatedCompanyId;
				let relationshipDirection;

				if (r.company1_id === focusCompanyId) {
					relatedCompanyId = r.company2_id;
					relationshipDirection = "outgoing";
				} else {
					relatedCompanyId = r.company1_id;
					relationshipDirection = "incoming";
				}

				const relatedCompany = await db.getCompanyById(relatedCompanyId);
				// relatedCompany will also contain all the new fields.

				return {
					relationship_id: r.relationship_id,
					company1_id: r.company1_id,
					company2_id: r.company2_id,
					relationship_type: r.relationship_type,
					relationship_status: r.status,
					description: r.description,
					start_date: r.start_date,
					connected_company_id: relatedCompanyId,
					// connected_company_details: relatedCompany, // This key is good
					direction_from_focus: relationshipDirection,
					relationship_with_focus: r.relationship_type,
					related_company_details: relatedCompany, // This key is good
				};
			})
		);

		res.json({
			focus_company: focusCompany,
			related_companies: relatedCompanyEntries,
		});
	} catch (error) {
		console.error("Error fetching company graph data:", error);
		res.status(500).json({ error: "Internal server error" });
	}
});

// Add a new company
app.post("/api/companies", async (req, res) => {
	try {
		const companyData = req.body; // This can now contain all the new fields
		if (!companyData.company_name) {
			return res.status(400).json({ error: "Company name is required" });
		}
		// The `db.addCompany` function in database.js is already updated
		// to handle all new fields passed in companyData.
		const result = await db.addCompany(companyData);
		res.status(201).json({
			message: "Company added successfully",
			companyId: result.lastID,
		});
	} catch (error) {
		console.error("Error adding company:", error);
		if (error.message.includes("UNIQUE constraint failed")) {
			return res.status(409).json({ error: "Company name already exists." });
		}
		res.status(500).json({ error: "Failed to add company" });
	}
});

// Get all companies
app.get("/api/companies", async (req, res) => {
	try {
		const companies = await db.getAllCompanies();
		// Each company object in the 'companies' array will now include
		// all the new fields (business_model, total_funding_m, etc.).
		// Your frontend should be prepared for this richer data.
		res.json(companies);
	} catch (error) {
		console.error("Error fetching all companies:", error);
		res.status(500).json({ error: "Failed to fetch companies" });
	}
});

// Add a relationship
app.post("/api/relationships", async (req, res) => {
	try {
		const relationshipData = req.body;
		if (!relationshipData.company1_id || !relationshipData.company2_id || !relationshipData.relationship_type) {
			return res.status(400).json({
				error: "company1_id, company2_id, and relationship_type are required.",
			});
		}
		const result = await db.addRelationship(relationshipData);
		res.status(201).json({
			message: "Relationship added successfully",
			relationshipId: result.lastID,
		});
	} catch (error) {
		console.error("Error adding relationship:", error);
		if (error.message.includes("UNIQUE constraint failed")) {
			return res.status(409).json({
				error: "This relationship already exists or company IDs are invalid.",
			});
		}
		if (error.message.includes("FOREIGN KEY constraint failed")) {
			return res.status(400).json({ error: "Invalid company ID(s) provided." });
		}
		res.status(500).json({ error: "Failed to add relationship" });
	}
});

// Update a company
app.put("/api/companies/:companyId", async (req, res) => {
	try {
		const companyId = parseInt(req.params.companyId);
		const companyData = req.body; // This can now contain any of the new fields for update
		if (isNaN(companyId)) {
			return res.status(400).json({ error: "Invalid company ID" });
		}

		// CRITICAL: Ensure COMPANY_UPDATABLE_FIELDS in database.js includes all the new
		// field names you want to be updatable (e.g., 'business_model', 'total_funding_m').
		// If they are not in that array, db.updateCompany will ignore them.
		const result = await db.updateCompany(companyId, companyData);

		if (result.changes === 0) {
			// Check if company exists to differentiate between not found and no actual change
			const companyExists = await db.getCompanyById(companyId);
			if (!companyExists) {
				return res.status(404).json({ error: "Company not found" });
			}
			return res.status(200).json({
				message:
					"No changes made to the company data (data might be the same or no valid fields to update were provided)",
				changes: 0,
			});
		}
		res.json({
			message: "Company updated successfully",
			changes: result.changes,
		});
	} catch (error) {
		console.error("Error updating company:", error);
		res.status(500).json({ error: "Failed to update company" });
	}
});

// --- Product Endpoints --- (No direct changes needed due to Company schema update)
app.post("/api/products", async (req, res) => {
	try {
		const productData = req.body;
		if (!productData.company_id || !productData.product_name) {
			return res.status(400).json({ error: "Company ID and Product Name are required." });
		}
		productData.company_id = parseInt(productData.company_id);
		if (isNaN(productData.company_id)) {
			return res.status(400).json({ error: "Valid Company ID is required." });
		}

		const result = await db.addProduct(productData);
		res.status(201).json({
			message: "Product added successfully",
			productId: result.lastID,
		});
	} catch (error) {
		console.error("Error adding product:", error);
		if (error.message.includes("FOREIGN KEY constraint failed")) {
			return res.status(400).json({
				error: "Invalid Company ID provided for the product.",
			});
		}
		res.status(500).json({ error: "Failed to add product" });
	}
});

// --- News/Event Endpoints --- (No direct changes needed due to Company schema update)
app.post("/api/news_events", async (req, res) => {
	try {
		const newsEventData = req.body;
		if (!newsEventData.title || !newsEventData.url) {
			return res.status(400).json({ error: "Title and URL are required for news/events." });
		}
		const result = await db.addNewsEvent(newsEventData);
		res.status(201).json({
			message: "News/Event added successfully",
			newsEventId: result.lastID,
		});
	} catch (error) {
		console.error("Error adding news/event:", error);
		if (error.message.includes("UNIQUE constraint failed") && error.message.includes("News_Events.url")) {
			return res.status(409).json({ error: "A news/event with this URL already exists." });
		}
		res.status(500).json({ error: "Failed to add news/event" });
	}
});

app.get("/api/news_events", async (req, res) => {
	try {
		const newsEvents = await db.getAllNewsEvents();
		res.json(newsEvents);
	} catch (error) {
		console.error("Error fetching news/events:", error);
		res.status(500).json({ error: "Failed to fetch news/events" });
	}
});

// --- Company to News/Event Link Endpoint --- (No direct changes needed)
app.post("/api/company_news_links", async (req, res) => {
	try {
		const linkData = req.body;
		if (!linkData.company_id || !linkData.news_event_id) {
			return res.status(400).json({ error: "Company ID and News Event ID are required." });
		}
		linkData.company_id = parseInt(linkData.company_id);
		linkData.news_event_id = parseInt(linkData.news_event_id);

		if (isNaN(linkData.company_id) || isNaN(linkData.news_event_id)) {
			return res.status(400).json({
				error: "Valid Company ID and News Event ID are required.",
			});
		}

		const result = await db.linkCompanyToNewsEvent(linkData);
		res.status(201).json({
			message: "Company linked to News/Event successfully",
			linkId: result.lastID,
		});
	} catch (error) {
		console.error("Error linking company to news/event:", error);
		if (error.message.includes("UNIQUE constraint failed")) {
			return res.status(409).json({
				error: "This company is already linked to this news/event with the same role.",
			});
		}
		if (error.message.includes("FOREIGN KEY constraint failed")) {
			return res.status(400).json({
				error: "Invalid Company ID or News/Event ID provided.",
			});
		}
		res.status(500).json({ error: "Failed to link company to news/event" });
	}
});

// Start the server
initializeDatabase().then(() => {
	app.listen(port, () => {
		console.log(`Server running at http://localhost:${port}`);
	});
});
