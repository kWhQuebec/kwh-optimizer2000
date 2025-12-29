import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, X, Send, Loader2, Bot, User, Minimize2, Maximize2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export function AIChatWidget() {
  const { language, t } = useI18n();
  const { user, token } = useAuth();
  const { toast } = useToast();
  
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState("");
  
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages, streamingMessage]);
  
  useEffect(() => {
    if (isOpen && !isMinimized && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen, isMinimized]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    
    const userMessage: ChatMessage = {
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    setStreamingMessage("");
    
    try {
      const response = await fetch("/api/ai-assistant/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: userMessage.content,
          conversationHistory: messages.map(m => ({
            role: m.role,
            content: m.content,
          })),
          language,
        }),
      });
      
      if (!response.ok) {
        throw new Error("Failed to send message");
      }
      
      const reader = response.body?.getReader();
      if (!reader) throw new Error("No reader available");
      
      const decoder = new TextDecoder();
      let fullResponse = "";
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");
        
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.substring(6));
              if (data.content) {
                fullResponse += data.content;
                setStreamingMessage(fullResponse);
              }
              if (data.done) {
                setMessages(prev => [...prev, {
                  role: "assistant",
                  content: fullResponse,
                  timestamp: new Date(),
                }]);
                setStreamingMessage("");
              }
              if (data.error) {
                throw new Error(data.error);
              }
            } catch (parseError) {
            }
          }
        }
      }
    } catch (error) {
      console.error("Chat error:", error);
      toast({
        title: language === "fr" ? "Erreur" : "Error",
        description: language === "fr" 
          ? "Impossible de contacter l'assistant IA" 
          : "Failed to contact AI assistant",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const toggleOpen = () => {
    setIsOpen(!isOpen);
    setIsMinimized(false);
  };
  
  const toggleMinimize = () => {
    setIsMinimized(!isMinimized);
  };
  
  if (!user) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50" data-testid="ai-chat-widget">
      {!isOpen ? (
        <Button
          onClick={toggleOpen}
          size="lg"
          className="rounded-full h-14 w-14 shadow-lg hover-elevate"
          data-testid="button-open-ai-chat"
        >
          <MessageCircle className="h-6 w-6" />
        </Button>
      ) : (
        <Card className={`w-96 shadow-2xl transition-all duration-200 ${isMinimized ? 'h-14' : 'h-[500px]'}`}>
          <CardHeader className="flex flex-row items-center justify-between gap-2 py-3 px-4 border-b">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">
                {language === "fr" ? "Assistant IA kWh" : "kWh AI Assistant"}
              </CardTitle>
              {user.role === "admin" || user.role === "analyst" ? (
                <Badge variant="secondary" className="text-xs">Staff</Badge>
              ) : null}
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleMinimize}
                className="h-7 w-7"
                data-testid="button-minimize-chat"
              >
                {isMinimized ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleOpen}
                className="h-7 w-7"
                data-testid="button-close-chat"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          
          {!isMinimized && (
            <>
              <CardContent className="p-0 flex-1 overflow-hidden h-[380px]">
                <ScrollArea className="h-full p-4" ref={scrollAreaRef}>
                  {messages.length === 0 && !streamingMessage && (
                    <div className="text-center text-muted-foreground py-8">
                      <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p className="text-sm">
                        {language === "fr" 
                          ? "Bonjour! Posez-moi des questions sur les sites, clients, analyses ou toute autre fonctionnalité de la plateforme."
                          : "Hello! Ask me questions about sites, clients, analyses, or any other platform feature."}
                      </p>
                      {(user.role === "admin" || user.role === "analyst") && (
                        <p className="text-xs mt-2 text-primary">
                          {language === "fr"
                            ? "En tant que membre du personnel, je peux aussi vous aider à modifier des données."
                            : "As a staff member, I can also help you modify data."}
                        </p>
                      )}
                    </div>
                  )}
                  
                  {messages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`mb-4 flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-lg px-4 py-2 ${
                          msg.role === "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          {msg.role === "user" ? (
                            <User className="h-3 w-3" />
                          ) : (
                            <Bot className="h-3 w-3" />
                          )}
                          <span className="text-xs opacity-70">
                            {msg.timestamp.toLocaleTimeString(language === "fr" ? "fr-CA" : "en-CA", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    </div>
                  ))}
                  
                  {streamingMessage && (
                    <div className="mb-4 flex justify-start">
                      <div className="max-w-[85%] rounded-lg px-4 py-2 bg-muted">
                        <div className="flex items-center gap-2 mb-1">
                          <Bot className="h-3 w-3" />
                          <Loader2 className="h-3 w-3 animate-spin" />
                        </div>
                        <p className="text-sm whitespace-pre-wrap">{streamingMessage}</p>
                      </div>
                    </div>
                  )}
                  
                  {isLoading && !streamingMessage && (
                    <div className="flex justify-start">
                      <div className="rounded-lg px-4 py-2 bg-muted">
                        <Loader2 className="h-4 w-4 animate-spin" />
                      </div>
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
              
              <CardFooter className="p-3 border-t">
                <form onSubmit={handleSubmit} className="flex w-full gap-2">
                  <Input
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={language === "fr" ? "Posez une question..." : "Ask a question..."}
                    disabled={isLoading}
                    className="flex-1"
                    data-testid="input-ai-chat-message"
                  />
                  <Button
                    type="submit"
                    size="icon"
                    disabled={!input.trim() || isLoading}
                    data-testid="button-send-ai-message"
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </form>
              </CardFooter>
            </>
          )}
        </Card>
      )}
    </div>
  );
}
