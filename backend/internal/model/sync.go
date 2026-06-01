package model

// SyncItem represents a single data sync instruction sent by the client.
type SyncItem struct {
	Table         string                 `json:"table"`
	Action        string                 `json:"action"`
	Payload       map[string]interface{} `json:"payload"`
	RequestID     string                 `json:"request_id"`
	CorrelationID string                 `json:"correlation_id"`
}

// BatchRequest encapsulates a list of sync items to be processed in batch.
type BatchRequest struct {
	Items []SyncItem `json:"items"`
}
