#!/usr/bin/env python

#python 2 and 3 http server
from http.server import SimpleHTTPRequestHandler
from http.server import HTTPServer

#create threads python
from threading import Thread

import webbrowser
import signal
import sys

port = 8000
host = 'localhost'

# Add CORS header to the website
class CORSRequestHandler (SimpleHTTPRequestHandler):
    def end_headers (self):
        self.send_header('Access-Control-Allow-Origin', 'http://henriquemiranda.github.io/')
        SimpleHTTPRequestHandler.end_headers(self)

# Quit application when SIGINT is received
def signal_handler(signal, frame):
    sys.exit(0)

if __name__ == '__main__':

    #initialize http server thread
    server = HTTPServer(('', port), CORSRequestHandler)
    server.url = 'http://{}:{}'.format(host,server.server_port)
    t = Thread(target=server.serve_forever)
    t.daemon = True
    t.start()
   
    #open website with the file
    filename = 'http://{}:{}/gr.json'.format(host,server.server_port)
    url = 'http://henriquemiranda.github.io/phononwebsite/phonon.html?json=%s'%filename
    webbrowser.open_new(url)

    print('Press Ctrl+C to terminate server')
    signal.signal(signal.SIGINT, signal_handler)
    signal.pause()
