const express = require("express");
// const fs = require("fs"); // No longer needed for CSV loading
// const csv = require("csv-parser"); // No longer needed for CSV loading
const path = require("path");
const db = require("./database"); // Import your database module

const app = express();
const port = 3000;
app.use(express.json()); // <--- Add this line HERE

// Initialize the database when the server starts
async function initializeDatabase() {
	try {
		await db.initDb(); // This creates tables if they don't exist
		console.log("Database initialized successfully.");
		// You could potentially load initial data from CSVs into the DB here if needed, one time.
		// For now, we'll assume data is added via API endpoints.
	} catch (err) {
		console.error("Failed to initialize database:", err);
		process.exit(1); // Exit if DB fails to initialize
	}
}
// Serve static files (HTML, CSS, frontend JS) from a 'public' directory
app.use(express.static(path.join(__dirname, "Frontend")));
//server threejs as 'three'
app.use(
	"/three",
	(req, res, next) => {
		console.log(`Serving /three static file: ${req.url}`);
		next();
	},
	express.static(path.join(__dirname, "../node_modules/three/"))
);
// Backend/server.js (continued)
app.get("/api/company/getCompanyNamesAndIds", async (req, res) => {
	// Fetch company names and IDs from the database
	try {
		/*
			TODO: Optimize this query by creating a dedicated SQL statement
			that directly selects only company names and IDs from the database,
			instead of fetching all company data and filtering it in JavaScript.
		*/
		const companies = await db.getAllCompanies();
		const companyList = companies.map((company) => ({
			id: company.company_id,
			name: company.company_name,
		}));
		res.json(companyList);
	} catch (error) {
		console.error("Error fetching company names and IDs:", error);
		res.status(500).json({ error: "Internal server error" });
	}
});
// --- API Endpoints for Data Retrieval ---
app.get("/api/company/:companyId/graph", async (req, res) => {
	const focusCompanyId = parseInt(req.params.companyId);
	if (isNaN(focusCompanyId)) {
		return res.status(400).json({ error: "Invalid company ID" });
	}

	try {
		const focusCompany = await db.getCompanyById(focusCompanyId); // Using DB function
		if (!focusCompany) {
			return res.status(404).json({ error: "Company not found" });
		}

		// Fetch relationships. getRelatedCompaniesByType is suitable here.
		// You might want to fetch all types of relationships or specific ones.
		// For this example, let's assume we want all relationship types.
		// We'll need to iterate through possible types or have a more generic function if needed.

		// A more direct way is to get all relationships and then process them:
		const directRelationships = await db.getRelationshipsForCompany(
			focusCompanyId
		); // Gets raw relationship entries

		const relatedCompanyEntries = await Promise.all(
			directRelationships.map(async (r) => {
				let relatedCompanyId;
				let relationshipDirection; // 'source_to_target' or 'target_to_source'

				if (r.company1_id === focusCompanyId) {
					relatedCompanyId = r.company2_id;
					relationshipDirection = "outgoing";
				} else {
					relatedCompanyId = r.company1_id;
					relationshipDirection = "incoming";
				}

				const relatedCompany = await db.getCompanyById(
					relatedCompanyId
				);

				return {
					relationship_id: r.relationship_id,
					company1_id: r.company1_id, // Original company1
					company2_id: r.company2_id, // Original company2
					relationship_type: r.relationship_type, // The defined type
					relationship_status: r.status,
					description: r.description,
					start_date: r.start_date,
					// Your frontend might need to know the "other" company and how it relates
					connected_company_id: relatedCompanyId,
					connected_company_details: relatedCompany,
					direction_from_focus: relationshipDirection,
					// The original server.js had `relationship_with_focus` and `related_company_details`
					// The structure below attempts to mimic that intent based on the new DB structure
					relationship_with_focus: r.relationship_type, // Type from perspective of the relationship record
					related_company_details: relatedCompany, // Details of the company at the other end
				};
			})
		);

		res.json({
			focus_company: focusCompany,
			// The key in your original server.js was 'related_companies'
			related_companies: relatedCompanyEntries,
		});
	} catch (error) {
		console.error("Error fetching company graph data:", error);
		res.status(500).json({ error: "Internal server error" });
	}
});
// --- API Endpoints for Data Mutation ---

// Add a new company
app.post("/api/companies", async (req, res) => {
	try {
		const companyData = req.body;
		// Add validation for companyData here if needed
		if (!companyData.company_name) {
			return res.status(400).json({ error: "Company name is required" });
		}
		const result = await db.addCompany(companyData);
		res.status(201).json({
			message: "Company added successfully",
			companyId: result.lastID,
		});
	} catch (error) {
		console.error("Error adding company:", error);
		if (error.message.includes("UNIQUE constraint failed")) {
			return res
				.status(409)
				.json({ error: "Company name already exists." });
		}
		res.status(500).json({ error: "Failed to add company" });
	}
});

// Get all companies (useful for populating dropdowns in frontend, etc.)
app.get("/api/companies", async (req, res) => {
	try {
		const companies = await db.getAllCompanies();
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
		// Add validation
		if (
			!relationshipData.company1_id ||
			!relationshipData.company2_id ||
			!relationshipData.relationship_type
		) {
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
			return res
				.status(400)
				.json({ error: "Invalid company ID(s) provided." });
		}
		res.status(500).json({ error: "Failed to add relationship" });
	}
});

// Update a company
app.put("/api/companies/:companyId", async (req, res) => {
	try {
		const companyId = parseInt(req.params.companyId);
		const companyData = req.body;
		if (isNaN(companyId)) {
			return res.status(400).json({ error: "Invalid company ID" });
		}
		const result = await db.updateCompany(companyId, companyData);
		if (result.changes === 0) {
			return res
				.status(404)
				.json({ error: "Company not found or no changes made" });
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

// --- Product Endpoints ---
app.post("/api/products", async (req, res) => {
	try {
		const productData = req.body;
		// Basic validation (you can expand this)
		if (!productData.company_id || !productData.product_name) {
			return res
				.status(400)
				.json({ error: "Company ID and Product Name are required." });
		}
		// Ensure company_id is an integer (frontend should also ensure this)
		productData.company_id = parseInt(productData.company_id);
		if (isNaN(productData.company_id)) {
			return res
				.status(400)
				.json({ error: "Valid Company ID is required." });
		}

		const result = await db.addProduct(productData); // Assumes db.addProduct exists from database.js
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

// --- News/Event Endpoints ---
app.post("/api/news_events", async (req, res) => {
	try {
		const newsEventData = req.body;
		// Basic validation
		if (!newsEventData.title || !newsEventData.url) {
			// Example: title and URL are mandatory
			return res
				.status(400)
				.json({ error: "Title and URL are required for news/events." });
		}
		const result = await db.addNewsEvent(newsEventData); // Assumes db.addNewsEvent exists
		res.status(201).json({
			message: "News/Event added successfully",
			newsEventId: result.lastID,
		});
	} catch (error) {
		console.error("Error adding news/event:", error);
		if (
			error.message.includes("UNIQUE constraint failed") &&
			error.message.includes("News_Events.url")
		) {
			return res
				.status(409)
				.json({ error: "A news/event with this URL already exists." });
		}
		res.status(500).json({ error: "Failed to add news/event" });
	}
});

app.get("/api/news_events", async (req, res) => {
	try {
		const newsEvents = await db.getAllNewsEvents(); // Assumes db.getAllNewsEvents exists
		res.json(newsEvents);
	} catch (error) {
		console.error("Error fetching news/events:", error);
		res.status(500).json({ error: "Failed to fetch news/events" });
	}
});

// --- Company to News/Event Link Endpoint ---
app.post("/api/company_news_links", async (req, res) => {
	try {
		const linkData = req.body;
		// Basic validation
		if (!linkData.company_id || !linkData.news_event_id) {
			return res
				.status(400)
				.json({ error: "Company ID and News Event ID are required." });
		}
		// Ensure IDs are integers
		linkData.company_id = parseInt(linkData.company_id);
		linkData.news_event_id = parseInt(linkData.news_event_id);

		if (isNaN(linkData.company_id) || isNaN(linkData.news_event_id)) {
			return res.status(400).json({
				error: "Valid Company ID and News Event ID are required.",
			});
		}

		const result = await db.linkCompanyToNewsEvent(linkData); // Assumes db.linkCompanyToNewsEvent exists
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

// Start the server after ensuring DB is initialized
initializeDatabase().then(() => {
	app.listen(port, () => {
		console.log(`Server running at http://localhost:${port}`);
	});
});
