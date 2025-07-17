import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Helper function to send input to tmux session
async function sendToTmux(sessionName: string, input: string): Promise<void> {
  try {
    // Send the input to the tmux session
    await execAsync(`tmux send-keys -t ${sessionName} "${input.replace(/"/g, '\\"')}" Enter`);
  } catch (error) {
    console.error('Error sending to tmux:', error);
    throw new Error(`Failed to send input to tmux session: ${sessionName}`);
  }
}

// Helper function to capture tmux session output
async function captureTmuxOutput(sessionName: string): Promise<string> {
  try {
    // Capture the pane content
    const { stdout } = await execAsync(`tmux capture-pane -t ${sessionName} -p`);
    return stdout;
  } catch (error) {
    console.error('Error capturing tmux output:', error);
    throw new Error(`Failed to capture output from tmux session: ${sessionName}`);
  }
}

// Helper function to wait for and extract specific response
async function waitForResponse(sessionName: string, userMessage: string, maxWaitTime: number = 240000): Promise<string> {
  const startTime = Date.now();
  const pollInterval = 500; // Poll every 500ms
  
  while (Date.now() - startTime < maxWaitTime) {
    const output = await captureTmuxOutput(sessionName);
    
    // Look for the user's message in the output to find the conversation
    const lines = output.split('\n');
    let foundUserMessage = false;
    let responseLines: string[] = [];
    let foundSeparator = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Look for the user's message
      if (line.includes(`You: ${userMessage}`)) {
        foundUserMessage = true;
        continue;
      }
      
      // If we found the user message, start collecting the response
      if (foundUserMessage && line.includes('🐶 Sniffle:')) {
        // Found the start of Sniffle's response
        const responseStart = line.indexOf('🐶 Sniffle:') + '🐶 Sniffle:'.length;
        const firstResponseLine = line.substring(responseStart).trim();
        if (firstResponseLine) {
          responseLines.push(firstResponseLine);
        }
        
        // Collect subsequent lines until we hit the separator
        for (let j = i + 1; j < lines.length; j++) {
          const nextLine = lines[j].trim();
          if (nextLine.startsWith('=====')) {
            foundSeparator = true;
            break;
          }
          if (nextLine && !nextLine.startsWith('You:')) {
            responseLines.push(nextLine);
          }
        }
        break;
      }
    }
    
    // If we found a complete response (with separator), return it
    if (foundUserMessage && responseLines.length > 0 && foundSeparator) {
      return responseLines.join('\n').trim();
    }
    
    // Wait before polling again
    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }
  
  throw new Error('Timeout waiting for agent response');
}

export async function POST(request: NextRequest) {
  try {
    const { message } = await request.json();
    
    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }
    
    // Handle ping message to check if agent is running
    if (message === '__ping__') {
      try {
        // Check if the agent tmux session exists
        await execAsync('tmux has-session -t agent');
        return NextResponse.json({ response: 'Agent is running' });
      } catch (error) {
        return NextResponse.json({ error: 'Agent session not found' }, { status: 503 });
      }
    }
    
    const sessionName = 'agent';
    
    // Check if the tmux session exists
    try {
      await execAsync(`tmux has-session -t ${sessionName}`);
    } catch (error) {
      return NextResponse.json({ 
        error: 'Agent session not found. Please start the agent first.' 
      }, { status: 503 });
    }
    
    // Send the message to the tmux session
    await sendToTmux(sessionName, message);
    
    // Wait for and capture the response
    const response = await waitForResponse(sessionName, message);
    
    return NextResponse.json({ response });
    
  } catch (error: any) {
    console.error('Agent proxy error:', error);
    return NextResponse.json({ 
      error: error.message || 'Internal server error' 
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ 
    message: 'Agent proxy is running. Use POST to send messages to the agent.' 
  });
}
