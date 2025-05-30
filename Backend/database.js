const sqlite3 = require("sqlite3").verbose();
const path = require("path");

// Define the path for the SQLite database file
const dbPath = path.resolve(__dirname, "companies.db");
let db;

/**
 * Connects to the SQLite database.
 * @returns {Promise<sqlite3.Database>} A promise that resolves with the database connection.
 */
function connectDb() {
	return new Promise((resolve, reject) => {
		if (db && db.open) {
			// Check if already connected
			resolve(db);
			return;
		}
		db = new sqlite3.Database(dbPath, (err) => {
			if (err) {
				console.error("Error connecting to the SQLite database.", err);
				reject(err);
			} else {
				console.log("Connected to the SQLite database.");
				resolve(db);
			}
		});
	});
}

/**
 * Initializes the database by creating tables if they don't already exist.
 * @returns {Promise<void>}
 */
async function initDb() {
	if (!db || !db.open) {
		// Ensure connection is active
		await connectDb();
	}

	return new Promise((resolve, reject) => {
		db.serialize(() => {
			// Enable foreign key support
			db.run("PRAGMA foreign_keys = ON;", (err) => {
				if (err) {
					console.error("Error enabling foreign keys:", err.message);
					// Do not reject here, allow table creation to proceed if possible,
					// but this is a critical warning.
				}
			});

			// Companies Table
			db.run(
				`
    CREATE TABLE IF NOT EXISTS Companies (
        company_id INTEGER PRIMARY KEY AUTOINCREMENT,
        company_name TEXT NOT NULL UNIQUE,
        industry TEXT,
        website TEXT,
        headquarters_location TEXT, 
        description TEXT,
        founded_date DATE,         
        employee_count INTEGER,    
        is_public BOOLEAN,         
        stock_ticker TEXT,         
        business_model TEXT,       
        sub_industry TEXT,         
        markets TEXT,              
        mosaic_overall INTEGER,    
        commercial_maturity TEXT,  
        country TEXT,              
        total_funding_m REAL,      
        latest_funding_amount_m REAL, 
        latest_funding_round TEXT, 
        latest_funding_date DATE,  
        company_status_csv TEXT,

        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
    `,
				(err) => {
					if (err) console.error("Error creating Companies table:", err.message);
					else console.log("Companies table checked/created.");
				}
			);

			// Products Table
			db.run(
				`
                CREATE TABLE IF NOT EXISTS Products (
                    product_id INTEGER PRIMARY KEY AUTOINCREMENT,
                    company_id INTEGER NOT NULL,
                    product_name TEXT NOT NULL,
                    description TEXT,
                    category TEXT,
                    launch_date DATE,
                    product_url TEXT,
                    status TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (company_id) REFERENCES Companies(company_id) ON DELETE CASCADE
                )
            `,
				(err) => {
					if (err) console.error("Error creating Products table:", err.message);
					else console.log("Products table checked/created.");
				}
			);

			// Relationships Table - Updated with 'Investor'
			db.run(
				`
                CREATE TABLE IF NOT EXISTS Relationships (
                    relationship_id INTEGER PRIMARY KEY AUTOINCREMENT,
                    company1_id INTEGER NOT NULL,
                    company2_id INTEGER NOT NULL,
                    relationship_type TEXT NOT NULL CHECK(relationship_type IN ('Partner', 'Vendor', 'Customer', 'Competitor', 'Investor')),
                    start_date DATE,
                    end_date DATE,
                    status TEXT,
                    description TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (company1_id) REFERENCES Companies(company_id) ON DELETE CASCADE,
                    FOREIGN KEY (company2_id) REFERENCES Companies(company_id) ON DELETE CASCADE,
                    CHECK(company1_id != company2_id),
                    UNIQUE(company1_id, company2_id, relationship_type)
                )
            `,
				(err) => {
					if (err) console.error("Error creating Relationships table:", err.message);
					else console.log("Relationships table checked/created.");
				}
			);

			// News_Events Table
			db.run(
				`
                CREATE TABLE IF NOT EXISTS News_Events (
                    news_event_id INTEGER PRIMARY KEY AUTOINCREMENT,
                    title TEXT NOT NULL,
                    url TEXT UNIQUE,
                    source_name TEXT,
                    publication_date DATE,
                    summary TEXT,
                    sentiment TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `,
				(err) => {
					if (err) console.error("Error creating News_Events table:", err.message);
					else console.log("News_Events table checked/created.");
				}
			);

			// Company_News_Events_Link Table
			db.run(
				`
                CREATE TABLE IF NOT EXISTS Company_News_Events_Link (
                    company_news_event_id INTEGER PRIMARY KEY AUTOINCREMENT,
                    company_id INTEGER NOT NULL,
                    news_event_id INTEGER NOT NULL,
                    role_in_event TEXT, -- e.g., 'Primary Subject', 'Mentioned', 'Investor', 'Investee'
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (company_id) REFERENCES Companies(company_id) ON DELETE CASCADE,
                    FOREIGN KEY (news_event_id) REFERENCES News_Events(news_event_id) ON DELETE CASCADE,
                    UNIQUE(company_id, news_event_id, role_in_event)
                )
            `,
				(err) => {
					if (err) {
						console.error("Error creating Company_News_Events_Link table:", err.message);
						return reject(err); // This is the last table creation, can reject on error
					}
					console.log("Company_News_Events_Link table checked/created.");

					// Triggers for updated_at
					const tablesWithUpdatedAt = ["Companies", "Products", "Relationships", "News_Events"];
					let triggerPromises = tablesWithUpdatedAt.map((table) => {
						return new Promise((resolveTrigger, rejectTrigger) => {
							db.run(
								`
                            CREATE TRIGGER IF NOT EXISTS set_${table}_updated_at
                            AFTER UPDATE ON ${table}
                            FOR EACH ROW
                            BEGIN
                                UPDATE ${table}
                                SET updated_at = CURRENT_TIMESTAMP
                                WHERE rowid = NEW.rowid;
                            END;
                        `,
								(triggerErr) => {
									if (triggerErr) {
										console.error(
											`Error creating updated_at trigger for ${table}:`,
											triggerErr.message
										);
										// Don't necessarily reject the whole initDb for a trigger error
										// but log it.
									} else {
										console.log(`updated_at trigger for ${table} checked/created.`);
									}
									resolveTrigger(); // Resolve whether trigger succeeded or failed to not block initDb
								}
							);
						});
					});

					Promise.all(triggerPromises)
						.then(() => resolve())
						.catch(reject);
				}
			);
		});
	});
}

/**
 * Generic function to run a GET query that fetches all rows.
 * @param {string} sql The SQL query.
 * @param {Array} params Parameters for the SQL query.
 * @returns {Promise<Array>} A promise that resolves with the rows or rejects with an error.
 */
function getAll(sql, params = []) {
	return new Promise((resolve, reject) => {
		if (!db) return reject(new Error("Database not initialized. Call connectDb() or initDb() first."));
		db.all(sql, params, (err, rows) => {
			if (err) {
				reject(err);
			} else {
				resolve(rows);
			}
		});
	});
}

/**
 * Generic function to run a GET query that fetches a single row.
 * @param {string} sql The SQL query.
 * @param {Array} params Parameters for the SQL query.
 * @returns {Promise<Object>} A promise that resolves with the row or rejects with an error.
 */
function getOne(sql, params = []) {
	return new Promise((resolve, reject) => {
		if (!db) return reject(new Error("Database not initialized. Call connectDb() or initDb() first."));
		db.get(sql, params, (err, row) => {
			if (err) {
				reject(err);
			} else {
				resolve(row);
			}
		});
	});
}

// --- Company Getters ---
async function getAllCompanies() {
	return getAll("SELECT * FROM Companies ORDER BY company_name");
}
async function getCompanyById(companyId) {
	return getOne("SELECT * FROM Companies WHERE company_id = ?", [companyId]);
}
async function getCompanyByName(companyName) {
	return getOne("SELECT * FROM Companies WHERE company_name = ?", [companyName]);
}

// --- Product Getters ---
/**
 * Gets all products.
 * @returns {Promise<Array>}
 */
async function getAllProducts() {
	return getAll(
		"SELECT p.*, c.company_name FROM Products p JOIN Companies c ON p.company_id = c.company_id ORDER BY p.product_name"
	);
}

/**
 * Gets a specific product by its ID.
 * @param {number} productId
 * @returns {Promise<Object>}
 */
async function getProductById(productId) {
	return getOne(
		"SELECT p.*, c.company_name FROM Products p JOIN Companies c ON p.company_id = c.company_id WHERE p.product_id = ?",
		[productId]
	);
}

/**
 * Gets all products offered by a specific company.
 * @param {number} companyId
 * @returns {Promise<Array>}
 */
async function getProductsByCompanyId(companyId) {
	return getAll(
		"SELECT p.*, c.company_name FROM Products p JOIN Companies c ON p.company_id = c.company_id WHERE p.company_id = ? ORDER BY p.product_name",
		[companyId]
	);
}

/**
 * Gets products by category.
 * @param {string} category
 * @returns {Promise<Array>}
 */
async function getProductsByCategory(category) {
	return getAll(
		"SELECT p.*, c.company_name FROM Products p JOIN Companies c ON p.company_id = c.company_id WHERE p.category = ? ORDER BY p.product_name",
		[category]
	);
}

// --- Relationship Getters ---
/**
 * Gets all relationships for a specific company.
 * This returns the raw relationship entries where the company is either company1 or company2.
 * @param {number} companyId
 * @returns {Promise<Array>}
 */
async function getRelationshipsForCompany(companyId) {
	const sql = `
        SELECT r.*, c1.company_name as company1_name, c2.company_name as company2_name
        FROM Relationships r
        JOIN Companies c1 ON r.company1_id = c1.company_id
        JOIN Companies c2 ON r.company2_id = c2.company_id
        WHERE r.company1_id = ? OR r.company2_id = ?
    `;
	return getAll(sql, [companyId, companyId]);
}

/**
 * Gets related companies for a specific company, based on relationship type.
 * For 'Investor' type:
 * - If companyId is an investor, returns companies it invested in (investees).
 * - If companyId is an investee, returns companies that invested in it (investors).
 * @param {number} companyId The ID of the company whose relationships are being queried.
 * @param {string} relationshipType E.g., 'Partner', 'Vendor', 'Customer', 'Competitor', 'Investor'.
 * @returns {Promise<Array>} A list of company objects that are related, along with relationship details.
 */
async function getRelatedCompaniesByType(companyId, relationshipType) {
	const sql = `
        SELECT 
            CASE
                WHEN r.company1_id = ? THEN c2.*
                ELSE c1.*
            END as related_company_details,
            r.relationship_id, 
            r.start_date, 
            r.status AS relationship_status, 
            r.description AS relationship_description,
            CASE
                WHEN r.company1_id = ? THEN 'company1_is_subject'
                ELSE 'company2_is_subject'
            END as subject_role_in_relationship
        FROM Relationships r
        JOIN Companies c1 ON r.company1_id = c1.company_id
        JOIN Companies c2 ON r.company2_id = c2.company_id
        WHERE ((r.company1_id = ? AND r.relationship_type = ?) OR (r.company2_id = ? AND r.relationship_type = ?))
        AND (c1.company_id != ? OR c2.company_id != ?) -- ensure we are getting the OTHER company
        AND ( (r.company1_id = ? AND c2.company_id != ?) OR (r.company2_id = ? AND c1.company_id != ?) )

    `;
	// Simpler Query:
	// Selects the "other" company in the relationship
	const simplerSql = `
      SELECT
        IIF(r.company1_id = ?, c2.company_id, c1.company_id) as related_company_id,
        IIF(r.company1_id = ?, c2.company_name, c1.company_name) as related_company_name,
        IIF(r.company1_id = ?, c2.industry, c1.industry) as related_company_industry,
        -- Add other company fields from c1 or c2 as needed
        c_subject.company_name as subject_company_name, -- The company whose perspective we are querying from
        r.relationship_id,
        r.relationship_type,
        r.start_date,
        r.status AS relationship_status,
        r.description AS relationship_description
      FROM Relationships r
      JOIN Companies c1 ON r.company1_id = c1.company_id
      JOIN Companies c2 ON r.company2_id = c2.company_id
      JOIN Companies c_subject ON c_subject.company_id = ? -- Join for the subject company name
      WHERE r.relationship_type = ?
        AND (r.company1_id = ? OR r.company2_id = ?)
        AND IIF(r.company1_id = ?, c2.company_id, c1.company_id) != ? -- Ensure the related company is not the subject company itself
    `;

	// Parameters for simplerSql:
	// 1: companyId (for IIF c1.id = ?)
	// 2: companyId (for IIF c1.id = ?)
	// 3: companyId (for IIF c1.id = ?)
	// 4: companyId (subject company for name)
	// 5: relationshipType
	// 6: companyId (company1_id = ?)
	// 7: companyId (company2_id = ?)
	// 8: companyId (for IIF c1.id = ?)
	// 9: companyId (subject company for !=)

	return getAll(simplerSql, [
		companyId,
		companyId,
		companyId,
		companyId,
		relationshipType,
		companyId,
		companyId,
		companyId,
		companyId,
	]);
}

async function getRelationshipById(relationshipId) {
	return getOne("SELECT * FROM Relationships WHERE relationship_id = ?", [relationshipId]);
}

// --- News/Events Getters ---
async function getAllNewsEvents(limit = null, offset = 0) {
	let sql = "SELECT * FROM News_Events ORDER BY publication_date DESC, news_event_id DESC";
	const params = [];
	if (limit !== null) {
		sql += " LIMIT ?";
		params.push(limit);
		sql += " OFFSET ?";
		params.push(offset);
	}
	return getAll(sql, params);
}
async function getNewsEventById(newsEventId) {
	return getOne("SELECT * FROM News_Events WHERE news_event_id = ?", [newsEventId]);
}

// --- Company - News/Events Link Getters ---
async function getNewsEventsByCompanyId(companyId) {
	const sql = `
        SELECT ne.*, cnel.role_in_event
        FROM News_Events ne
        JOIN Company_News_Events_Link cnel ON ne.news_event_id = cnel.news_event_id
        WHERE cnel.company_id = ?
        ORDER BY ne.publication_date DESC
    `;
	return getAll(sql, [companyId]);
}
async function getCompaniesByNewsEventId(newsEventId) {
	const sql = `
        SELECT c.*, cnel.role_in_event
        FROM Companies c
        JOIN Company_News_Events_Link cnel ON c.company_id = cnel.company_id
        WHERE cnel.news_event_id = ?
    `;
	return getAll(sql, [newsEventId]);
}

/**
 * Closes the database connection.
 * @returns {Promise<void>}
 */
function closeDb() {
	return new Promise((resolve, reject) => {
		if (db && db.open) {
			db.close((err) => {
				if (err) {
					console.error("Error closing the database connection.", err);
					reject(err);
				} else {
					console.log("Database connection closed.");
					db = null; // Clear the instance
					resolve();
				}
			});
		} else {
			db = null; // Ensure db is null if not open
			resolve(); // No connection to close
		}
	});
}
// Place these functions within your database.js file

// --- INSERT Functions ---

/**
 * Adds a new company to the database.
 * @param {object} companyData Object containing company details.
 * @param {string} companyData.company_name
 * @param {string} [companyData.industry]
 * @param {string} [companyData.website]
 * @param {string} [companyData.headquarters_location]
 * @param {string} [companyData.description]
 * @param {string} [companyData.founded_date] // YYYY-MM-DD
 * @param {number} [companyData.employee_count]
 * @param {boolean} [companyData.is_public]
 * @param {string} [companyData.stock_ticker]
 * @returns {Promise<{lastID: number, changes: number}>}
 */
/**
 * Adds a new company to the database.
 * @param {object} companyData Object containing company details.
 * @param {string} companyData.company_name
 * // ... (other existing params) ...
 * @param {string} [companyData.business_model]
 * @param {string} [companyData.sub_industry]
 * @param {string} [companyData.markets] // Could be JSON string
 * @param {number} [companyData.mosaic_overall]
 * @param {string} [companyData.commercial_maturity]
 * @param {string} [companyData.country]
 * @param {number} [companyData.total_funding_m]
 * @param {number} [companyData.latest_funding_amount_m]
 * @param {string} [companyData.latest_funding_round]
 * @param {string} [companyData.latest_funding_date] // YYYY-MM-DD
 * @param {string} [companyData.company_status_csv]
 * @returns {Promise<{lastID: number, changes: number}>}
 */
async function addCompany(companyData) {
	const {
		company_name,
		industry = null,
		website = null,
		headquarters_location = null,
		description = null,
		founded_date = null, // Ensure YYYY-MM-DD from CSV's "Founded Year"
		employee_count = null, // From CSV "Total Headcount"
		is_public = false, // Default, as not in CSV
		stock_ticker = null, // Default, as not in CSV

		// New fields
		business_model = null,
		sub_industry = null,
		markets = null,
		mosaic_overall = null,
		commercial_maturity = null,
		country = null,
		total_funding_m = null,
		latest_funding_amount_m = null,
		latest_funding_round = null,
		latest_funding_date = null, // Ensure YYYY-MM-DD from CSV
		company_status_csv = null,
	} = companyData;

	if (!company_name) {
		return Promise.reject(new Error("Company name is required."));
	}

	const sql = `INSERT INTO Companies (
                    company_name, industry, website, headquarters_location, description,
                    founded_date, employee_count, is_public, stock_ticker,
                    business_model, sub_industry, markets, mosaic_overall, commercial_maturity,
                    country, total_funding_m, latest_funding_amount_m, latest_funding_round,
                    latest_funding_date, company_status_csv
                 )
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`; // 20 placeholders

	return run(sql, [
		company_name,
		industry,
		website,
		headquarters_location,
		description,
		founded_date,
		employee_count,
		is_public,
		stock_ticker,
		business_model,
		sub_industry,
		markets,
		mosaic_overall,
		commercial_maturity,
		country,
		total_funding_m,
		latest_funding_amount_m,
		latest_funding_round,
		latest_funding_date,
		company_status_csv,
	]);
}

/**
 * Adds a new product to the database.
 * @param {object} productData Object containing product details.
 * @param {number} productData.company_id
 * @param {string} productData.product_name
 * @param {string} [productData.description]
 * @param {string} [productData.category]
 * @param {string} [productData.launch_date] // YYYY-MM-DD
 * @param {string} [productData.product_url]
 * @param {string} [productData.status]
 * @returns {Promise<{lastID: number, changes: number}>}
 */
async function addProduct(productData) {
	const {
		company_id,
		product_name,
		description = null,
		category = null,
		launch_date = null,
		product_url = null,
		status = null,
	} = productData;

	if (!company_id || !product_name) {
		return Promise.reject(new Error("Company ID and Product name are required."));
	}
	const sql = `INSERT INTO Products (company_id, product_name, description, category, launch_date, product_url, status)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`;
	return run(sql, [company_id, product_name, description, category, launch_date, product_url, status]);
}

/**
 * Adds a new relationship between two companies.
 * @param {object} relationshipData
 * @param {number} relationshipData.company1_id
 * @param {number} relationshipData.company2_id
 * @param {string} relationshipData.relationship_type - ('Partner', 'Vendor', 'Customer', 'Competitor', 'Investor')
 * @param {string} [relationshipData.start_date] // YYYY-MM-DD
 * @param {string} [relationshipData.end_date] // YYYY-MM-DD
 * @param {string} [relationshipData.status]
 * @param {string} [relationshipData.description]
 * @returns {Promise<{lastID: number, changes: number}>}
 */
async function addRelationship(relationshipData) {
	const {
		company1_id,
		company2_id,
		relationship_type,
		start_date = null,
		end_date = null,
		status = null,
		description = null,
	} = relationshipData;

	if (!company1_id || !company2_id || !relationship_type) {
		return Promise.reject(new Error("Company1 ID, Company2 ID, and Relationship Type are required."));
	}
	if (company1_id === company2_id) {
		return Promise.reject(new Error("Company1 ID and Company2 ID cannot be the same."));
	}
	const validTypes = ["Partner", "Vendor", "Customer", "Competitor", "Investor"];
	if (!validTypes.includes(relationship_type)) {
		return Promise.reject(new Error(`Invalid relationship type. Must be one of: ${validTypes.join(", ")}`));
	}

	const sql = `INSERT INTO Relationships (company1_id, company2_id, relationship_type, start_date, end_date, status, description)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`;
	return run(sql, [company1_id, company2_id, relationship_type, start_date, end_date, status, description]);
}

/**
 * Adds a new news event.
 * @param {object} newsEventData
 * @param {string} newsEventData.title
 * @param {string} [newsEventData.url]
 * @param {string} [newsEventData.source_name]
 * @param {string} [newsEventData.publication_date] // YYYY-MM-DD
 * @param {string} [newsEventData.summary]
 * @param {string} [newsEventData.sentiment]
 * @returns {Promise<{lastID: number, changes: number}>}
 */
async function addNewsEvent(newsEventData) {
	const {
		title,
		url = null,
		source_name = null,
		publication_date = null,
		summary = null,
		sentiment = null,
	} = newsEventData;

	if (!title) {
		return Promise.reject(new Error("News event title is required."));
	}
	const sql = `INSERT INTO News_Events (title, url, source_name, publication_date, summary, sentiment)
                 VALUES (?, ?, ?, ?, ?, ?)`;
	return run(sql, [title, url, source_name, publication_date, summary, sentiment]);
}

/**
 * Links a company to a news event.
 * @param {object} linkData
 * @param {number} linkData.company_id
 * @param {number} linkData.news_event_id
 * @param {string} [linkData.role_in_event]
 * @returns {Promise<{lastID: number, changes: number}>}
 */
async function linkCompanyToNewsEvent(linkData) {
	const { company_id, news_event_id, role_in_event = null } = linkData;
	if (!company_id || !news_event_id) {
		return Promise.reject(new Error("Company ID and News Event ID are required."));
	}
	const sql = `INSERT INTO Company_News_Events_Link (company_id, news_event_id, role_in_event)
                 VALUES (?, ?, ?)`;
	return run(sql, [company_id, news_event_id, role_in_event]);
}

// --- UPDATE Functions ---

// Helper for dynamic UPDATE queries
function buildUpdateQuery(tableName, idColumnName, idValue, data, allowedFields) {
	const fieldsToUpdate = [];
	const values = [];

	for (const key of allowedFields) {
		if (data.hasOwnProperty(key)) {
			fieldsToUpdate.push(`${key} = ?`);
			values.push(data[key]);
		}
	}

	if (fieldsToUpdate.length === 0) {
		return { error: "No valid fields provided for update." };
	}

	values.push(idValue); // Add the ID for the WHERE clause
	const sql = `UPDATE ${tableName} SET ${fieldsToUpdate.join(", ")} WHERE ${idColumnName} = ?`;
	return { sql, values };
}

// In database.js
const COMPANY_UPDATABLE_FIELDS = [
	"company_name",
	"industry",
	"website",
	"headquarters_location",
	"description",
	"founded_date",
	"employee_count",
	"is_public",
	"stock_ticker",
	// ADD YOUR NEW FIELDS HERE:
	"business_model",
	"sub_industry",
	"markets",
	"mosaic_overall",
	"commercial_maturity",
	"country",
	"total_funding_m",
	"latest_funding_amount_m",
	"latest_funding_round",
	"latest_funding_date",
	"company_status_csv",
];
async function updateCompany(companyId, companyData) {
	const { sql, values, error } = buildUpdateQuery(
		"Companies",
		"company_id",
		companyId,
		companyData,
		COMPANY_UPDATABLE_FIELDS
	);
	if (error) return Promise.reject(new Error(error));
	return run(sql, values);
}

const PRODUCT_UPDATABLE_FIELDS = [
	"product_name",
	"description",
	"category",
	"launch_date",
	"product_url",
	"status",
	"company_id",
]; // company_id if product can be reassigned
async function updateProduct(productId, productData) {
	const { sql, values, error } = buildUpdateQuery(
		"Products",
		"product_id",
		productId,
		productData,
		PRODUCT_UPDATABLE_FIELDS
	);
	if (error) return Promise.reject(new Error(error));
	return run(sql, values);
}

// For relationships, updating company1_id, company2_id, or relationship_type is often complex
// (better to delete and create new). This focuses on other attributes.
const RELATIONSHIP_UPDATABLE_FIELDS = ["start_date", "end_date", "status", "description"];
async function updateRelationship(relationshipId, relationshipData) {
	const { sql, values, error } = buildUpdateQuery(
		"Relationships",
		"relationship_id",
		relationshipId,
		relationshipData,
		RELATIONSHIP_UPDATABLE_FIELDS
	);
	if (error) return Promise.reject(new Error(error));
	return run(sql, values);
}

const NEWS_EVENT_UPDATABLE_FIELDS = ["title", "url", "source_name", "publication_date", "summary", "sentiment"];
async function updateNewsEvent(newsEventId, newsEventData) {
	const { sql, values, error } = buildUpdateQuery(
		"News_Events",
		"news_event_id",
		newsEventId,
		newsEventData,
		NEWS_EVENT_UPDATABLE_FIELDS
	);
	if (error) return Promise.reject(new Error(error));
	return run(sql, values);
}

// Company_News_Events_Link usually updated by role or re-linking.
const COMPANY_NEWS_EVENT_LINK_UPDATABLE_FIELDS = ["role_in_event"];
async function updateCompanyNewsEventLink(linkId, linkData) {
	const { sql, values, error } = buildUpdateQuery(
		"Company_News_Events_Link",
		"company_news_event_id",
		linkId,
		linkData,
		COMPANY_NEWS_EVENT_LINK_UPDATABLE_FIELDS
	);
	if (error) return Promise.reject(new Error(error));
	return run(sql, values);
}

/**
 * Generic function to run an INSERT, UPDATE, or DELETE query.
 * @param {string} sql The SQL query.
 * * @param {Array} params Parameters for the SQL query.
 * @returns {Promise<{lastID: number, changes: number}>} A promise that resolves with an object containing
 * lastID (for INSERTs) and changes (number of rows affected).
 */
function run(sql, params = []) {
	return new Promise((resolve, reject) => {
		if (!db) {
			// Attempt to connect if db is not initialized
			// This assumes connectDb() is available and initializes the module 'db' variable
			// Or, more robustly, ensure initDb() has been called by the application's startup sequence.
			console.warn("Database not initialized. Attempting to connect. Ensure initDb() was called.");
			connectDb()
				.then(() => {
					// connectDb should ideally be exported or part of the module's init flow
					performRun();
				})
				.catch((err) => reject(new Error("Database connection failed: " + err.message)));
		} else {
			performRun();
		}

		function performRun() {
			db.run(sql, params, function (err) {
				// Must use function() to access 'this'
				if (err) {
					console.error("SQL Error:", err.message);
					console.error("SQL:", sql);
					console.error("Params:", params);
					reject(err);
				} else {
					resolve({ lastID: this.lastID, changes: this.changes });
				}
			});
		}
	});
}
// In database.js
async function getCompanyIdAndNameList() {
	return getAll(
		"SELECT company_id AS id, company_name AS name FROM Companies WHERE company_id < 6075 ORDER BY company_name"
	);
}
// Don't forget to export it in module.exports

module.exports = {
	connectDb,
	initDb,
	closeDb,
	// Generic helpers
	// run, // You might choose to export 'run' or keep it internal
	// getAll, // Already there
	// getOne, // Already there

	// Company Getters
	getAllCompanies,
	getCompanyById,
	getCompanyByName,
	// Product Getters
	getAllProducts,
	getProductById,
	getProductsByCompanyId,
	getProductsByCategory,
	// Relationship Getters
	getRelationshipsForCompany,
	getRelatedCompaniesByType,
	getRelationshipById,
	// News/Events Getters
	getAllNewsEvents,
	getNewsEventById,
	// Link Getters
	getNewsEventsByCompanyId,
	getCompaniesByNewsEventId,
	// Company ID and Name List
	getCompanyIdAndNameList,
	// --- New Mutator Functions ---
	// Inserts
	addCompany,
	addProduct,
	addRelationship,
	addNewsEvent,
	linkCompanyToNewsEvent,
	// Updates
	updateCompany,
	updateProduct,
	updateRelationship,
	updateNewsEvent,
	updateCompanyNewsEventLink,
};

// // --- Example Usage (for testing) ---
// // You'll need to create INSERT functions to populate data before most getters are useful.
// async function main() {
// 	try {
// 		await initDb();
// 		console.log("Database initialized.");

// 		// Example: Assume some companies exist (you'd use INSERT functions)
// 		// const companyAId = 1; // Placeholder
// 		// const companyBId = 2; // Placeholder

// 		// Querying products for a company (assuming company with ID 1 exists)
// 		// const productsOfCompany1 = await getProductsByCompanyId(companyAId);
// 		// console.log(`\nProducts of Company ID ${companyAId}:`, productsOfCompany1);

// 		// Querying for investors of a company (companyBId)
// 		// console.log(`\nInvestors of Company ID ${companyBId}:`);
// 		// const investorsInB = await getRelatedCompaniesByType(companyBId, 'Investor');
// 		// console.log(investorsInB);
// 		// Note: This function returns companies that are related as 'Investor'.
// 		// If companyBId is company2_id (investee), it returns company1_id (investor).

// 		// Querying for companies invested in by a company (companyAId)
// 		// console.log(`\nCompanies invested in by Company ID ${companyAId}:`);
// 		// const investmentsByA = await getRelatedCompaniesByType(companyAId, 'Investor');
// 		// console.log(investmentsByA);
// 		// Note: If companyAId is company1_id (investor), it returns company2_id (investee).

// 		// Test: Get all companies
// 		const companies = await getAllCompanies();
// 		console.log(
// 			"\nAll Companies:",
// 			companies.length > 0 ? companies[0] : "No companies"
// 		);

// 		if (companies.length > 0) {
// 			const testCompanyId = companies[0].company_id;
// 			console.log(
// 				`\nRelationships for company ${testCompanyId} (${companies[0].company_name}):`
// 			);
// 			const rels = await getRelatedCompaniesByType(
// 				testCompanyId,
// 				"Partner"
// 			); // or 'Investor', 'Customer' etc.
// 			console.log(rels);
// 		}
// 	} catch (err) {
// 		console.error("An error occurred during main execution:", err);
// 	} finally {
// 		await closeDb();
// 	}
// }

// // To run this example:
// // 1. Make sure you have companies.db file or it will be created.
// // 2. You'll need to add INSERT functions and call them to have data to query.
// // main(); // Uncomment to run example usage when you have INSERTs or data
