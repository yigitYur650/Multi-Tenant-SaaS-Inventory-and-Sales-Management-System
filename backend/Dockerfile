# Stage 1: Build stage
FROM golang:1.22-alpine AS builder

WORKDIR /app

# Install git/certificates (in case of private go modules)
RUN apk add --no-cache git ca-certificates

# Copy dependency files and download
COPY go.mod go.sum ./
RUN go mod download

# Copy the rest of the source code
COPY . .

# Build the Go application
# CGO_ENABLED=0 compiles a statically linked binary (ideal for scratch/alpine)
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o main ./cmd/server

# Stage 2: Final runtime stage
FROM alpine:3.19

WORKDIR /app

# Import ca-certificates from builder for TLS connections
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/

# Copy the pre-built binary
COPY --from=builder /app/main .

# Expose port (fiber app listens on 3001)
EXPOSE 3001

# Run the binary
CMD ["./main"]
