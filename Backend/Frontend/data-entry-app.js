document.addEventListener("DOMContentLoaded", () => {
	// --- Company Form Logic ---
	const addCompanyForm = document.getElementById("addCompanyForm");
	if (addCompanyForm) {
		addCompanyForm.addEventListener("submit", async (event) => {
			event.preventDefault();
			const messageDiv = document.getElementById("addCompanyMessage");
			messageDiv.textContent = "";

			const formData = new FormData(addCompanyForm);
			const companyData = Object.fromEntries(formData.entries());

			// --- Data Type Adjustments ---
			// Employee Count (convert to integer)
			if (
				companyData.employee_count &&
				companyData.employee_count.trim() !== ""
			) {
				companyData.employee_count = parseInt(
					companyData.employee_count,
					10
				);
				if (isNaN(companyData.employee_count)) {
					// Handle error or set to null if preferred
					messageDiv.textContent =
						"Employee count must be a valid number.";
					return;
				}
			} else {
				// If empty, decide how to handle: send null, 0, or omit
				companyData.employee_count = null; // Or delete companyData.employee_count;
			}

			// Is Public (checkbox to boolean)
			// A checked checkbox with name 'is_public' will have its value in formData (default 'on' if no value attribute).
			// If unchecked, it won't be present in formData.entries().
			companyData.is_public = formData.has("is_public"); // true if checked, false if not

			// Optional: Ensure empty optional fields that are not numbers/booleans are sent as null
			// if your backend expects nulls instead of empty strings for certain text/date fields.
			// For example:
			// if (companyData.founded_date === '') companyData.founded_date = null;
			// if (companyData.stock_ticker === '') companyData.stock_ticker = null;
			// (The backend database.js functions already default to null if these are not provided)

			// date fields are created_at, and updated_at
			// Ensure date fields are in the correct format if needed
			if (
				companyData.founded_date &&
				companyData.founded_date.trim() !== ""
			) {
				const date = new Date(companyData.founded_date);
				if (isNaN(date.getTime())) {
					messageDiv.textContent =
						"Invalid date format for founded date.";
					return;
				}
				companyData.founded_date = date.toISOString();
			} else {
				companyData.founded_date = null; // Or delete companyData.founded_date;
			}
			try {
				const response = await fetch("/api/companies", {
					// To server.js endpoint
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify(companyData),
				});

				const result = await response.json();

				if (response.ok) {
					messageDiv.textContent = `Company added successfully! ID: ${result.companyId}`;
					addCompanyForm.reset();
					fetchCompaniesForDropdowns(); // Refresh dropdowns
				} else {
					messageDiv.textContent = `Error: ${
						result.error || response.statusText
					}`;
				}
			} catch (error) {
				console.error("Add company error:", error);
				messageDiv.textContent =
					"Failed to add company. See console for details.";
			}
		});
	}

	// --- Product Form Logic (Example with potential parsing) ---
	// (Inside DOMContentLoaded)
	const addProductForm = document.getElementById("addProductForm");
	if (addProductForm) {
		addProductForm.addEventListener("submit", async (event) => {
			event.preventDefault();
			const messageDiv = document.getElementById("addProductMessage");
			messageDiv.textContent = "";
			const formData = new FormData(addProductForm);
			const productData = Object.fromEntries(formData.entries());

			// Ensure numeric IDs are numbers
			productData.company_id = parseInt(productData.company_id, 10);
			// Any other numeric fields for product would be parsed here

			// Handle API call (ensure POST /api/products exists in server.js)
			try {
				const response = await fetch("/api/products", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(productData),
				});
				const result = await response.json();
				if (response.ok) {
					messageDiv.textContent = `Product added successfully! ID: ${result.productId}`;
					addProductForm.reset();
				} else {
					messageDiv.textContent = `Error: ${
						result.error || "Failed to add product"
					}`;
				}
			} catch (err) {
				messageDiv.textContent = "Error submitting product form.";
				console.error("Submit product error:", err);
			}
		});
	}

	// --- Relationship Form Logic (Example with potential parsing) ---
	// (Inside DOMContentLoaded)
	const addRelationshipForm = document.getElementById("addRelationshipForm");
	if (addRelationshipForm) {
		addRelationshipForm.addEventListener("submit", async (event) => {
			event.preventDefault();
			const messageDiv = document.getElementById(
				"addRelationshipMessage"
			);
			messageDiv.textContent = "";
			const formData = new FormData(addRelationshipForm);
			const relationshipData = Object.fromEntries(formData.entries());

			relationshipData.company1_id = parseInt(
				relationshipData.company1_id,
				10
			);
			relationshipData.company2_id = parseInt(
				relationshipData.company2_id,
				10
			);

			if (relationshipData.company1_id === relationshipData.company2_id) {
				messageDiv.textContent =
					"Company 1 and Company 2 cannot be the same.";
				return;
			}
			// Handle API call (POST /api/relationships from server.js)
			try {
				const response = await fetch("/api/relationships", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(relationshipData),
				});
				const result = await response.json();
				if (response.ok) {
					messageDiv.textContent = `Relationship added successfully! ID: ${result.relationshipId}`;
					addRelationshipForm.reset();
				} else {
					messageDiv.textContent = `Error: ${
						result.error || "Failed to add relationship"
					}`;
				}
			} catch (err) {
				messageDiv.textContent = "Error submitting relationship form.";
				console.error("Submit relationship error:", err);
			}
		});
	}
	// --- News/Event Form Logic ---
	// (Inside DOMContentLoaded)
	const addNewsEventForm = document.getElementById("addNewsEventForm");
	if (addNewsEventForm) {
		addNewsEventForm.addEventListener("submit", async (event) => {
			event.preventDefault();
			const messageDiv = document.getElementById("addNewsEventMessage");
			messageDiv.textContent = "";
			const formData = new FormData(addNewsEventForm);
			const newsEventData = Object.fromEntries(formData.entries());

			// Handle API call (ensure POST /api/news_events exists in server.js)
			try {
				const response = await fetch("/api/news_events", {
					// You'll need to create this endpoint
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(newsEventData),
				});
				const result = await response.json();
				if (response.ok) {
					messageDiv.textContent = `News/Event added successfully! ID: ${result.newsEventId}`; // Adjust based on backend response
					addNewsEventForm.reset();
					fetchNewsEventsForDropdowns(); // Refresh dropdowns
				} else {
					messageDiv.textContent = `Error: ${
						result.error || "Failed to add news/event"
					}`;
				}
			} catch (err) {
				messageDiv.textContent = "Error submitting news/event form.";
				console.error("Submit news/event error:", err);
			}
		});
	}
	// --- Link Company to News/Event Form Logic ---
	// (Inside DOMContentLoaded)
	const linkCompanyNewsEventForm = document.getElementById(
		"linkCompanyNewsEventForm"
	);
	if (linkCompanyNewsEventForm) {
		linkCompanyNewsEventForm.addEventListener("submit", async (event) => {
			event.preventDefault();
			const messageDiv = document.getElementById(
				"linkCompanyNewsEventMessage"
			);
			messageDiv.textContent = "";
			const formData = new FormData(linkCompanyNewsEventForm);
			const linkData = Object.fromEntries(formData.entries());

			linkData.company_id = parseInt(linkData.company_id, 10);
			linkData.news_event_id = parseInt(linkData.news_event_id, 10);

			// Handle API call (ensure POST /api/company_news_links exists in server.js)
			try {
				const response = await fetch("/api/company_news_links", {
					// You'll need to create this endpoint
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(linkData),
				});
				const result = await response.json();
				if (response.ok) {
					messageDiv.textContent = `Link added successfully! ID: ${result.linkId}`; // Adjust
					linkCompanyNewsEventForm.reset();
				} else {
					messageDiv.textContent = `Error: ${
						result.error || "Failed to link"
					}`;
				}
			} catch (err) {
				messageDiv.textContent = "Error submitting link form.";
				console.error("Submit link error:", err);
			}
		});
	}
	// Call functions to populate dropdowns on page load
	fetchCompaniesForDropdowns();
	fetchNewsEventsForDropdowns(); // if you have news/event forms
});

// The fetchCompaniesForDropdowns function remains the same
async function fetchCompaniesForDropdowns() {
	try {
		const response = await fetch("/api/companies"); // To server.js endpoint
		if (!response.ok)
			throw new Error(`HTTP error! status: ${response.status}`);
		const companies = await response.json();
		document
			.querySelectorAll(".company-select")
			.forEach((selectElement) => {
				const currentSelection = selectElement.value;
				selectElement.innerHTML =
					'<option value="">-- Select Company --</option>';
				companies.forEach((company) => {
					const option = document.createElement("option");
					option.value = company.company_id;
					option.textContent = `${company.company_name} (ID: ${company.company_id})`;
					selectElement.appendChild(option);
				});
				if (currentSelection) selectElement.value = currentSelection;
			});
	} catch (error) {
		console.error("Error fetching companies for dropdowns:", error);
	}
}
// Placeholder for fetching news events - ensure this is implemented
async function fetchNewsEventsForDropdowns() {
	console.log(
		"Fetching news/events for dropdowns (implementation pending)..."
	);
	// Implement similar to fetchCompaniesForDropdowns, targeting '/api/news_events' (GET)
	// and populating '.news-event-select' dropdowns.
	try {
		// You'll need to create a GET /api/news_events endpoint in your server.js
		const response = await fetch("/api/news_events"); // Create this GET endpoint
		if (!response.ok)
			throw new Error(`HTTP error! status: ${response.status}`);
		const newsEvents = await response.json();

		document
			.querySelectorAll(".news-event-select")
			.forEach((selectElement) => {
				const currentSelection = selectElement.value;
				selectElement.innerHTML =
					'<option value="">-- Select News/Event --</option>';
				newsEvents.forEach((eventItem) => {
					// Renamed 'event' to 'eventItem' to avoid conflict if 'event' is used in a higher scope
					const option = document.createElement("option");
					option.value = eventItem.news_event_id;
					option.textContent = `${eventItem.title.substring(
						0,
						50
					)}... (ID: ${eventItem.news_event_id})`;
					selectElement.appendChild(option);
				});
				if (currentSelection) selectElement.value = currentSelection;
			});
	} catch (error) {
		console.error("Error fetching news/events for dropdowns:", error);
	}
}
