import { getAccessToken } from "./firebase.ts";

export interface GmailMessageSummary {
  id: string;
  threadId: string;
  sender: string;
  subject: string;
  date: string;
  snippet: string;
  isUnread: boolean;
  link: string;
}

export interface CalendarEventItem {
  id: string;
  summary: string;
  description?: string;
  start: string;
  end: string;
  location?: string;
  htmlLink: string;
}

export interface GoogleTaskItem {
  id: string;
  title: string;
  notes?: string;
  due?: string;
  status: "needsAction" | "completed";
  updated?: string;
}

export interface DriveFileItem {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
  webViewLink: string;
  iconLink?: string;
}

export interface ContactItem {
  resourceName: string;
  name: string;
  email?: string;
  phone?: string;
}

export interface GoogleFormItem {
  formId: string;
  title: string;
  description?: string;
  responderUri: string;
  editUri: string;
  questionCount: number;
}

// Helper to make authenticated Google Workspace calls
async function fetchGoogleApi(url: string, options: RequestInit = {}): Promise<any> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error("NOT_AUTHENTICATED: Please sign in with your Google Account to access this service.");
  }

  const headers = new Headers(options.headers || {});
  headers.set("Authorization", `Bearer ${token}`);
  if (!headers.has("Content-Type") && options.body && typeof options.body === "string") {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(url, { ...options, headers });

  if (res.status === 401) {
    throw new Error("TOKEN_EXPIRED: Your Google session has expired. Please sign in again.");
  }

  if (res.status === 403) {
    const errorData = await res.json().catch(() => null);
    const msg = errorData?.error?.message || "PERMISSION_DENIED: Required Google scope not granted.";
    throw new Error(msg);
  }

  if (!res.ok) {
    const errorData = await res.json().catch(() => null);
    throw new Error(errorData?.error?.message || `Google API error (Status ${res.status})`);
  }

  // Handle empty responses (like 204 No Content on delete)
  if (res.status === 204) return true;
  return await res.json();
}

/* =========================================================================
   1. GMAIL INTEGRATION
   ========================================================================= */

export async function listGmailMessages(query: string = "label:INBOX", maxResults: number = 10): Promise<GmailMessageSummary[]> {
  const encodedQuery = encodeURIComponent(query);
  const data = await fetchGoogleApi(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodedQuery}&maxResults=${maxResults}`
  );

  const messages = data.messages || [];
  if (messages.length === 0) return [];

  // Fetch headers for each message concurrently
  const detailed = await Promise.all(
    messages.slice(0, maxResults).map(async (m: { id: string }) => {
      try {
        const details = await fetchGoogleApi(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`
        );
        const headers = details.payload?.headers || [];
        const fromHeader = headers.find((h: any) => h.name.toLowerCase() === "from")?.value || "Unknown Sender";
        const subjectHeader = headers.find((h: any) => h.name.toLowerCase() === "subject")?.value || "(No Subject)";
        const dateHeader = headers.find((h: any) => h.name.toLowerCase() === "date")?.value || "";
        const isUnread = Array.isArray(details.labelIds) && details.labelIds.includes("UNREAD");

        return {
          id: details.id,
          threadId: details.threadId,
          sender: fromHeader,
          subject: subjectHeader,
          date: dateHeader ? new Date(dateHeader).toLocaleDateString() : "",
          snippet: details.snippet || "",
          isUnread,
          link: `https://mail.google.com/mail/u/0/#inbox/${details.id}`,
        };
      } catch (e) {
        return null;
      }
    })
  );

  return detailed.filter((d): d is GmailMessageSummary => d !== null);
}

export async function sendGmailEmail(params: {
  to: string;
  subject: string;
  body: string;
}): Promise<{ id: string; threadId: string }> {
  // Construct RFC 2822 base64 email
  const utf8Subject = `=?utf-8?B?${Buffer.from(params.subject).toString("base64")}?=`;
  const messageParts = [
    `To: ${params.to}`,
    "Content-Type: text/plain; charset=utf-8",
    "MIME-Version: 1.0",
    `Subject: ${utf8Subject}`,
    "",
    params.body,
  ];
  const message = messageParts.join("\r\n");

  // Base64url encode
  const base64Encoded = btoa(unescape(encodeURIComponent(message)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  return await fetchGoogleApi("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    body: JSON.stringify({ raw: base64Encoded }),
  });
}

export async function createGmailDraft(params: {
  to: string;
  subject: string;
  body: string;
}): Promise<{ id: string }> {
  const utf8Subject = `=?utf-8?B?${Buffer.from(params.subject).toString("base64")}?=`;
  const messageParts = [
    `To: ${params.to}`,
    "Content-Type: text/plain; charset=utf-8",
    "MIME-Version: 1.0",
    `Subject: ${utf8Subject}`,
    "",
    params.body,
  ];
  const message = messageParts.join("\r\n");
  const base64Encoded = btoa(unescape(encodeURIComponent(message)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  return await fetchGoogleApi("https://gmail.googleapis.com/gmail/v1/users/me/drafts", {
    method: "POST",
    body: JSON.stringify({ message: { raw: base64Encoded } }),
  });
}

/* =========================================================================
   2. GOOGLE CALENDAR INTEGRATION
   ========================================================================= */

export async function listCalendarEvents(timeMin?: string, timeMax?: string): Promise<CalendarEventItem[]> {
  const now = new Date();
  const min = timeMin || new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const max = timeMax || new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString();

  const data = await fetchGoogleApi(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(
      min
    )}&timeMax=${encodeURIComponent(max)}&singleEvents=true&orderBy=startTime&maxResults=20`
  );

  const items = data.items || [];
  return items.map((item: any) => ({
    id: item.id,
    summary: item.summary || "(No Title)",
    description: item.description,
    start: item.start?.dateTime || item.start?.date || "",
    end: item.end?.dateTime || item.end?.date || "",
    location: item.location,
    htmlLink: item.htmlLink || `https://calendar.google.com/calendar/r/eventedit/${item.id}`,
  }));
}

export async function createCalendarEvent(event: {
  summary: string;
  description?: string;
  startDateTime: string; // ISO string
  endDateTime: string; // ISO string
  location?: string;
}): Promise<CalendarEventItem> {
  const payload = {
    summary: event.summary,
    description: event.description || "",
    location: event.location || "",
    start: {
      dateTime: event.startDateTime,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    end: {
      dateTime: event.endDateTime,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
  };

  const created = await fetchGoogleApi("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return {
    id: created.id,
    summary: created.summary,
    description: created.description,
    start: created.start?.dateTime || created.start?.date || "",
    end: created.end?.dateTime || created.end?.date || "",
    location: created.location,
    htmlLink: created.htmlLink,
  };
}

export async function deleteCalendarEvent(eventId: string): Promise<boolean> {
  await fetchGoogleApi(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`, {
    method: "DELETE",
  });
  return true;
}

/* =========================================================================
   3. GOOGLE TASKS INTEGRATION
   ========================================================================= */

export async function listGoogleTasks(taskListId: string = "@default"): Promise<GoogleTaskItem[]> {
  const data = await fetchGoogleApi(`https://tasks.googleapis.com/tasks/v1/lists/${taskListId}/tasks?maxResults=50`);
  const items = data.items || [];
  return items.map((item: any) => ({
    id: item.id,
    title: item.title || "(Untitled Task)",
    notes: item.notes,
    due: item.due,
    status: item.status,
    updated: item.updated,
  }));
}

export async function createGoogleTask(task: {
  title: string;
  notes?: string;
  due?: string; // RFC 3339 timestamp (e.g. 2026-11-11T19:00:00Z)
  taskListId?: string;
}): Promise<GoogleTaskItem> {
  const taskListId = task.taskListId || "@default";
  const payload: any = { title: task.title };
  if (task.notes) payload.notes = task.notes;
  if (task.due) payload.due = task.due;

  const created = await fetchGoogleApi(`https://tasks.googleapis.com/tasks/v1/lists/${taskListId}/tasks`, {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return {
    id: created.id,
    title: created.title,
    notes: created.notes,
    due: created.due,
    status: created.status,
    updated: created.updated,
  };
}

export async function updateGoogleTaskStatus(
  taskId: string,
  completed: boolean,
  taskListId: string = "@default"
): Promise<GoogleTaskItem> {
  const status = completed ? "completed" : "needsAction";
  const updated = await fetchGoogleApi(
    `https://tasks.googleapis.com/tasks/v1/lists/${taskListId}/tasks/${taskId}`,
    {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }
  );
  return {
    id: updated.id,
    title: updated.title,
    notes: updated.notes,
    due: updated.due,
    status: updated.status,
    updated: updated.updated,
  };
}

export async function deleteGoogleTask(taskId: string, taskListId: string = "@default"): Promise<boolean> {
  await fetchGoogleApi(`https://tasks.googleapis.com/tasks/v1/lists/${taskListId}/tasks/${taskId}`, {
    method: "DELETE",
  });
  return true;
}

/* =========================================================================
   4. GOOGLE DRIVE INTEGRATION
   ========================================================================= */

export async function listDriveFiles(query: string = "trashed = false", pageSize: number = 20): Promise<DriveFileItem[]> {
  const encodedQuery = encodeURIComponent(query);
  const fields = encodeURIComponent("files(id, name, mimeType, size, modifiedTime, webViewLink, iconLink)");
  const data = await fetchGoogleApi(
    `https://www.googleapis.com/drive/v3/files?q=${encodedQuery}&pageSize=${pageSize}&fields=${fields}&orderBy=modifiedTime desc`
  );

  const items = data.files || [];
  return items.map((f: any) => ({
    id: f.id,
    name: f.name,
    mimeType: f.mimeType,
    size: f.size ? formatBytes(Number(f.size)) : undefined,
    modifiedTime: f.modifiedTime ? new Date(f.modifiedTime).toLocaleDateString() : undefined,
    webViewLink: f.webViewLink || `https://drive.google.com/file/d/${f.id}/view`,
    iconLink: f.iconLink,
  }));
}

export async function uploadDriveFile(name: string, mimeType: string, content: string): Promise<DriveFileItem> {
  // Simple multipart upload to Drive
  const boundary = "-------314159265358979323846";
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const metadata = {
    name,
    mimeType,
  };

  const multipartRequestBody =
    delimiter +
    "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
    JSON.stringify(metadata) +
    delimiter +
    `Content-Type: ${mimeType}\r\n\r\n` +
    content +
    closeDelimiter;

  const token = await getAccessToken();
  if (!token) throw new Error("NOT_AUTHENTICATED: Please sign in with your Google Account.");

  const res = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,webViewLink", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body: multipartRequestBody,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => null);
    throw new Error(errorData?.error?.message || "Failed to upload file to Google Drive");
  }

  const created = await res.json();
  return {
    id: created.id,
    name: created.name,
    mimeType: created.mimeType,
    webViewLink: created.webViewLink || `https://drive.google.com/file/d/${created.id}/view`,
  };
}

/* =========================================================================
   5. GOOGLE CONTACTS (PEOPLE API)
   ========================================================================= */

export async function listGoogleContacts(): Promise<ContactItem[]> {
  const data = await fetchGoogleApi(
    "https://people.googleapis.com/v1/people/me/connections?personFields=names,emailAddresses,phoneNumbers&pageSize=50"
  );

  const connections = data.connections || [];
  return connections.map((p: any) => {
    const name = p.names?.[0]?.displayName || "Unnamed Contact";
    const email = p.emailAddresses?.[0]?.value;
    const phone = p.phoneNumbers?.[0]?.value;
    return {
      resourceName: p.resourceName,
      name,
      email,
      phone,
    };
  });
}

export async function createGoogleContact(contact: {
  givenName: string;
  familyName?: string;
  email?: string;
  phone?: string;
}): Promise<ContactItem> {
  const payload: any = {
    names: [
      {
        givenName: contact.givenName,
        familyName: contact.familyName || "",
      },
    ],
  };

  if (contact.email) {
    payload.emailAddresses = [{ value: contact.email }];
  }
  if (contact.phone) {
    payload.phoneNumbers = [{ value: contact.phone }];
  }

  const created = await fetchGoogleApi("https://people.googleapis.com/v1/people:createContact", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return {
    resourceName: created.resourceName,
    name: created.names?.[0]?.displayName || `${contact.givenName} ${contact.familyName || ""}`.trim(),
    email: created.emailAddresses?.[0]?.value,
    phone: created.phoneNumbers?.[0]?.value,
  };
}

/* =========================================================================
   6. GOOGLE FORMS INTEGRATION
   ========================================================================= */

export async function createGoogleForm(
  title: string,
  description: string,
  questions: Array<{
    title: string;
    type: "RADIO" | "CHECKBOX" | "TEXT";
    options?: string[];
  }>
): Promise<GoogleFormItem> {
  // 1. Create the blank form container
  const createData = await fetchGoogleApi("https://forms.googleapis.com/v1/forms", {
    method: "POST",
    body: JSON.stringify({
      info: {
        title,
        documentTitle: title,
      },
    }),
  });

  const formId = createData.formId;
  const responderUri = createData.responderUri || `https://docs.google.com/forms/d/e/${formId}/viewform`;
  const editUri = `https://docs.google.com/forms/d/${formId}/edit`;

  // 2. Add description and batch update items (questions)
  const requests: any[] = [];

  if (description) {
    requests.push({
      updateFormInfo: {
        info: {
          description,
        },
        updateMask: "description",
      },
    });
  }

  questions.forEach((q, index) => {
    if (q.type === "TEXT") {
      requests.push({
        createItem: {
          item: {
            title: q.title,
            questionItem: {
              question: {
                required: false,
                textQuestion: {
                  paragraph: false,
                },
              },
            },
          },
          location: {
            index,
          },
        },
      });
    } else {
      const options = q.options && q.options.length > 0 ? q.options : ["Option 1", "Option 2", "Option 3", "Option 4"];
      requests.push({
        createItem: {
          item: {
            title: q.title,
            questionItem: {
              question: {
                required: false,
                choiceQuestion: {
                  type: q.type === "CHECKBOX" ? "CHECKBOX" : "RADIO",
                  options: options.map((opt) => ({ value: opt })),
                  shuffle: false,
                },
              },
            },
          },
          location: {
            index,
          },
        },
      });
    }
  });

  if (requests.length > 0) {
    await fetchGoogleApi(`https://forms.googleapis.com/v1/forms/${formId}:batchUpdate`, {
      method: "POST",
      body: JSON.stringify({ requests }),
    });
  }

  return {
    formId,
    title,
    description,
    responderUri,
    editUri,
    questionCount: questions.length,
  };
}

// Utility formatting
function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}
