import React from 'react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = {hasError: false};
    }

    static getDerivedStateFromError() {
        return {hasError: true};
    }

    componentDidCatch(error, errorInfo) {
        console.error('Application error:', error, errorInfo);
    }

    handleReload = () => {
        window.location.reload();
    };

    handleGoToLogin = () => {
        window.location.href = '/login';
    };

    render() {
        if (this.state.hasError) {
            return (
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100vh',
                    fontFamily: 'sans-serif',
                    color: '#333',
                    textAlign: 'center',
                    padding: '2rem',
                }}>
                    <h1 style={{fontSize: '1.5rem', marginBottom: '1rem'}}>Something went wrong</h1>
                    <p style={{marginBottom: '2rem', color: '#666'}}>
                        The application encountered an unexpected error. Please try reloading the page.
                    </p>
                    <div style={{display: 'flex', gap: '1rem'}}>
                        <button
                            onClick={this.handleReload}
                            style={{
                                padding: '0.5rem 1.5rem',
                                fontSize: '1rem',
                                cursor: 'pointer',
                                border: '1px solid #ccc',
                                borderRadius: '4px',
                                backgroundColor: '#007bff',
                                color: '#fff',
                            }}
                        >
                            Reload page
                        </button>
                        <button
                            onClick={this.handleGoToLogin}
                            style={{
                                padding: '0.5rem 1.5rem',
                                fontSize: '1rem',
                                cursor: 'pointer',
                                border: '1px solid #ccc',
                                borderRadius: '4px',
                                backgroundColor: '#fff',
                                color: '#333',
                            }}
                        >
                            Go to login
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
