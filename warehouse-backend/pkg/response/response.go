package response

import "github.com/gin-gonic/gin"

type Response struct {
    Success bool   `json:"success"`
    Message string `json:"message,omitempty"`
    Data    any    `json:"data,omitempty"`
    Error   string `json:"error,omitempty"`
}

func OK(c *gin.Context, data any) {
    c.JSON(200, Response{Success: true, Data: data})
}

func Created(c *gin.Context, data any) {
    c.JSON(201, Response{Success: true, Data: data})
}

func BadRequest(c *gin.Context, msg string) {
    c.JSON(400, Response{Success: false, Error: msg})
}

func Unauthorized(c *gin.Context, msg string) {
    c.JSON(401, Response{Success: false, Error: msg})
}

func Forbidden(c *gin.Context) {
    c.JSON(403, Response{Success: false, Error: "forbidden"})
}

func NotFound(c *gin.Context, msg string) {
    c.JSON(404, Response{Success: false, Error: msg})
}

func InternalError(c *gin.Context, msg string) {
    c.JSON(500, Response{Success: false, Error: msg})
}