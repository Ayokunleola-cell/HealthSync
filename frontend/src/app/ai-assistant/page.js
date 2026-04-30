'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import styles from './page.module.css';

export default function AIAssistant() {
    const [loading, setLoading] = useState(false);
    const [patients, setPatients] = useState([]);
    const [selectedPatient, setSelectedPatient] = useState('');
    const [activeTab, setActiveTab] = useState('care-notes');

    // Care Notes State
    const [careNoteData, setCareNoteData] = useState({
        heart_rate: '',
        blood_pressure: '',
        temperature: '',
        oxygen_saturation: '',
        medications_given: '',
        meals: '',
        activities: '',
        sleep_quality: '',
        mood: '',
        observations: ''
    });
    const [generatedNote, setGeneratedNote] = useState('');

    // Recommendations State
    const [recommendations, setRecommendations] = useState('');
    const [context, setContext] = useState('');

    // Risk Analysis State
    const [riskAnalysis, setRiskAnalysis] = useState(null);

    // Drug Interactions State
    const [medications, setMedications] = useState('');
    const [interactions, setInteractions] = useState(null);

    // Vital Analysis State
    const [vitalAnalysis, setVitalAnalysis] = useState(null);

    const router = useRouter();

    useEffect(() => {
        fetchPatients();
    }, []);

    const fetchPatients = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/patients', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                setPatients(data.patients || []);
                if (data.patients?.length > 0) {
                    setSelectedPatient(data.patients[0].id);
                }
            }
        } catch (error) {
            console.error('Error fetching patients:', error);
        }
    };

    const getToken = () => localStorage.getItem('token');

    const generateCareNote = async () => {
        if (!selectedPatient) return;
        setLoading(true);
        try {
            const response = await fetch('/api/ai/generate-care-note', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${getToken()}`
                },
                body: JSON.stringify({
                    patient_id: selectedPatient,
                    ...careNoteData,
                    medications_given: careNoteData.medications_given.split(',').map(m => m.trim()).filter(Boolean)
                })
            });
            const data = await response.json();
            setGeneratedNote(data.care_note || 'Failed to generate note');
        } catch (error) {
            setGeneratedNote('Error generating care note: ' + error.message);
        }
        setLoading(false);
    };

    const getCareRecommendations = async () => {
        if (!selectedPatient) return;
        setLoading(true);
        try {
            const response = await fetch('/api/ai/care-recommendations', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${getToken()}`
                },
                body: JSON.stringify({
                    patient_id: selectedPatient,
                    context: context
                })
            });
            const data = await response.json();
            setRecommendations(data.recommendations || 'No recommendations available');
        } catch (error) {
            setRecommendations('Error: ' + error.message);
        }
        setLoading(false);
    };

    const getPatientRisk = async () => {
        if (!selectedPatient) return;
        setLoading(true);
        try {
            const response = await fetch(`/api/ai/patient-risk/${selectedPatient}`, {
                headers: { 'Authorization': `Bearer ${getToken()}` }
            });
            const data = await response.json();
            setRiskAnalysis(data);
        } catch (error) {
            setRiskAnalysis({ error: error.message });
        }
        setLoading(false);
    };

    const checkDrugInteractions = async () => {
        if (!medications) return;
        setLoading(true);
        try {
            const response = await fetch('/api/ai/drug-interactions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${getToken()}`
                },
                body: JSON.stringify({
                    medications: medications.split(',').map(m => m.trim()).filter(Boolean)
                })
            });
            const data = await response.json();
            setInteractions(data);
        } catch (error) {
            setInteractions({ error: error.message });
        }
        setLoading(false);
    };

    const analyzeVitals = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/ai/analyze-vitals', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${getToken()}`
                },
                body: JSON.stringify({
                    heart_rate: parseInt(careNoteData.heart_rate) || null,
                    blood_pressure: careNoteData.blood_pressure || null,
                    temperature: parseFloat(careNoteData.temperature) || null,
                    oxygen_saturation: parseInt(careNoteData.oxygen_saturation) || null
                })
            });
            const data = await response.json();
            setVitalAnalysis(data);
        } catch (error) {
            setVitalAnalysis({ error: error.message });
        }
        setLoading(false);
    };

    const tabs = [
        { id: 'care-notes', label: 'Care Notes AI' },
        { id: 'recommendations', label: 'Recommendations' },
        { id: 'risk-analysis', label: 'Risk Analysis' },
        { id: 'drug-check', label: 'Drug Interactions' },
        { id: 'vital-analysis', label: 'Vital Analysis' }
    ];

    return (
        <div className={styles.page}>
            <header className={styles.header}>
                <h1>AI Assistant</h1>
                <p>AI-powered care support and analysis</p>
            </header>

            <div className={styles.patientSelect}>
                <label>Select Patient:</label>
                <select
                    value={selectedPatient}
                    onChange={(e) => setSelectedPatient(e.target.value)}
                >
                    {patients.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                </select>
            </div>

            <div className={styles.tabs}>
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        className={`${styles.tab} ${activeTab === tab.id ? styles.active : ''}`}
                        onClick={() => setActiveTab(tab.id)}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            <div className={styles.content}>
                {activeTab === 'care-notes' && (
                    <div className={styles.section}>
                        <h2>Generate Care Note</h2>
                        <p className={styles.description}>Enter patient data to generate an AI-powered care note.</p>

                        <div className={styles.formGrid}>
                            <div className="input-group">
                                <label className="input-label">Heart Rate (bpm)</label>
                                <input
                                    type="number"
                                    className="input"
                                    value={careNoteData.heart_rate}
                                    onChange={(e) => setCareNoteData({ ...careNoteData, heart_rate: e.target.value })}
                                    placeholder="72"
                                />
                            </div>
                            <div className="input-group">
                                <label className="input-label">Blood Pressure</label>
                                <input
                                    type="text"
                                    className="input"
                                    value={careNoteData.blood_pressure}
                                    onChange={(e) => setCareNoteData({ ...careNoteData, blood_pressure: e.target.value })}
                                    placeholder="120/80"
                                />
                            </div>
                            <div className="input-group">
                                <label className="input-label">Temperature (F)</label>
                                <input
                                    type="number"
                                    step="0.1"
                                    className="input"
                                    value={careNoteData.temperature}
                                    onChange={(e) => setCareNoteData({ ...careNoteData, temperature: e.target.value })}
                                    placeholder="98.6"
                                />
                            </div>
                            <div className="input-group">
                                <label className="input-label">O2 Saturation (%)</label>
                                <input
                                    type="number"
                                    className="input"
                                    value={careNoteData.oxygen_saturation}
                                    onChange={(e) => setCareNoteData({ ...careNoteData, oxygen_saturation: e.target.value })}
                                    placeholder="98"
                                />
                            </div>
                        </div>

                        <div className="input-group">
                            <label className="input-label">Medications Given (comma separated)</label>
                            <input
                                type="text"
                                className="input"
                                value={careNoteData.medications_given}
                                onChange={(e) => setCareNoteData({ ...careNoteData, medications_given: e.target.value })}
                                placeholder="Lisinopril 10mg, Metformin 500mg"
                            />
                        </div>

                        <div className={styles.formGrid}>
                            <div className="input-group">
                                <label className="input-label">Meals</label>
                                <input
                                    type="text"
                                    className="input"
                                    value={careNoteData.meals}
                                    onChange={(e) => setCareNoteData({ ...careNoteData, meals: e.target.value })}
                                    placeholder="Breakfast eaten, lunch partial"
                                />
                            </div>
                            <div className="input-group">
                                <label className="input-label">Activities</label>
                                <input
                                    type="text"
                                    className="input"
                                    value={careNoteData.activities}
                                    onChange={(e) => setCareNoteData({ ...careNoteData, activities: e.target.value })}
                                    placeholder="Morning walk, physical therapy"
                                />
                            </div>
                        </div>

                        <div className={styles.formGrid}>
                            <div className="input-group">
                                <label className="input-label">Sleep Quality</label>
                                <select
                                    className="input"
                                    value={careNoteData.sleep_quality}
                                    onChange={(e) => setCareNoteData({ ...careNoteData, sleep_quality: e.target.value })}
                                >
                                    <option value="">Select...</option>
                                    <option value="Good - 8 hours">Good - 8 hours</option>
                                    <option value="Fair - 6 hours">Fair - 6 hours</option>
                                    <option value="Poor - restless">Poor - Restless</option>
                                </select>
                            </div>
                            <div className="input-group">
                                <label className="input-label">Mood/Behavior</label>
                                <select
                                    className="input"
                                    value={careNoteData.mood}
                                    onChange={(e) => setCareNoteData({ ...careNoteData, mood: e.target.value })}
                                >
                                    <option value="">Select...</option>
                                    <option value="Alert and cooperative">Alert and cooperative</option>
                                    <option value="Mild confusion">Mild confusion</option>
                                    <option value="Anxious">Anxious</option>
                                    <option value="Agitated">Agitated</option>
                                </select>
                            </div>
                        </div>

                        <div className="input-group">
                            <label className="input-label">Additional Observations</label>
                            <textarea
                                className="input"
                                rows={3}
                                value={careNoteData.observations}
                                onChange={(e) => setCareNoteData({ ...careNoteData, observations: e.target.value })}
                                placeholder="Any other observations..."
                            />
                        </div>

                        <button
                            className="btn btn-primary"
                            onClick={generateCareNote}
                            disabled={loading || !selectedPatient}
                        >
                            {loading ? 'Generating...' : 'Generate Care Note'}
                        </button>

                        {generatedNote && (
                            <div className={styles.result}>
                                <h3>Generated Care Note</h3>
                                <pre>{generatedNote}</pre>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'recommendations' && (
                    <div className={styles.section}>
                        <h2>AI Care Recommendations</h2>
                        <p className={styles.description}>Get personalized care recommendations based on patient condition.</p>

                        <div className="input-group">
                            <label className="input-label">Context (optional)</label>
                            <textarea
                                className="input"
                                rows={2}
                                value={context}
                                onChange={(e) => setContext(e.target.value)}
                                placeholder="E.g., Patient showing signs of increased confusion today..."
                            />
                        </div>

                        <button
                            className="btn btn-primary"
                            onClick={getCareRecommendations}
                            disabled={loading || !selectedPatient}
                        >
                            {loading ? 'Getting Recommendations...' : 'Get Recommendations'}
                        </button>

                        {recommendations && (
                            <div className={styles.result}>
                                <h3>Care Recommendations</h3>
                                <pre>{recommendations}</pre>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'risk-analysis' && (
                    <div className={styles.section}>
                        <h2>Patient Risk Analysis</h2>
                        <p className={styles.description}>Analyze patient risk factors and get preventive recommendations.</p>

                        <button
                            className="btn btn-primary"
                            onClick={getPatientRisk}
                            disabled={loading || !selectedPatient}
                        >
                            {loading ? 'Analyzing...' : 'Analyze Patient Risk'}
                        </button>

                        {riskAnalysis && (
                            <div className={styles.result}>
                                <div className={styles.riskCard}>
                                    <div className={`${styles.riskScore} ${styles[riskAnalysis.risk_level]}`}>
                                        <span className={styles.scoreValue}>{riskAnalysis.risk_score}</span>
                                        <span className={styles.scoreLabel}>{riskAnalysis.risk_level?.toUpperCase()} RISK</span>
                                    </div>

                                    {riskAnalysis.risk_factors?.length > 0 && (
                                        <div className={styles.riskFactors}>
                                            <h4>Risk Factors:</h4>
                                            <ul>
                                                {riskAnalysis.risk_factors.map((f, i) => (
                                                    <li key={i}>{f}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}

                                    <div className={styles.riskRecommendations}>
                                        <h4>Recommendations:</h4>
                                        <p>{riskAnalysis.recommendations}</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'drug-check' && (
                    <div className={styles.section}>
                        <h2>Drug Interaction Checker</h2>
                        <p className={styles.description}>Check for potential drug interactions between medications.</p>

                        <div className="input-group">
                            <label className="input-label">Medications (comma separated)</label>
                            <input
                                type="text"
                                className="input"
                                value={medications}
                                onChange={(e) => setMedications(e.target.value)}
                                placeholder="warfarin, aspirin, lisinopril"
                            />
                        </div>

                        <button
                            className="btn btn-primary"
                            onClick={checkDrugInteractions}
                            disabled={loading || !medications}
                        >
                            {loading ? 'Checking...' : 'Check Interactions'}
                        </button>

                        {interactions && (
                            <div className={styles.result}>
                                {interactions.has_interactions ? (
                                    <div className={styles.warningBox}>
                                        <h3>Interactions Found!</h3>
                                        {interactions.interactions.map((i, idx) => (
                                            <div key={idx} className={styles.interaction}>
                                                <strong>{i.drug1} + {i.drug2}</strong>
                                                <p>Severity: {i.severity}</p>
                                                <p>{i.recommendation}</p>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className={styles.successBox}>
                                        <h3>No Interactions Found</h3>
                                        <p>The medications listed do not have known interactions in our database.</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'vital-analysis' && (
                    <div className={styles.section}>
                        <h2>Vital Signs Analysis</h2>
                        <p className={styles.description}>Analyze vital signs for abnormalities and risk assessment.</p>

                        <div className={styles.formGrid}>
                            <div className="input-group">
                                <label className="input-label">Heart Rate (bpm)</label>
                                <input
                                    type="number"
                                    className="input"
                                    value={careNoteData.heart_rate}
                                    onChange={(e) => setCareNoteData({ ...careNoteData, heart_rate: e.target.value })}
                                    placeholder="72"
                                />
                            </div>
                            <div className="input-group">
                                <label className="input-label">Blood Pressure</label>
                                <input
                                    type="text"
                                    className="input"
                                    value={careNoteData.blood_pressure}
                                    onChange={(e) => setCareNoteData({ ...careNoteData, blood_pressure: e.target.value })}
                                    placeholder="120/80"
                                />
                            </div>
                            <div className="input-group">
                                <label className="input-label">O2 Saturation (%)</label>
                                <input
                                    type="number"
                                    className="input"
                                    value={careNoteData.oxygen_saturation}
                                    onChange={(e) => setCareNoteData({ ...careNoteData, oxygen_saturation: e.target.value })}
                                    placeholder="98"
                                />
                            </div>
                        </div>

                        <button
                            className="btn btn-primary"
                            onClick={analyzeVitals}
                            disabled={loading}
                        >
                            {loading ? 'Analyzing...' : 'Analyze Vitals'}
                        </button>

                        {vitalAnalysis && (
                            <div className={styles.result}>
                                <div className={`${styles.riskCard} ${styles[vitalAnalysis.risk_level]}`}>
                                    <div className={styles.riskScore}>
                                        <span className={styles.scoreLabel}>{vitalAnalysis.risk_level?.toUpperCase()} RISK</span>
                                    </div>

                                    {vitalAnalysis.alerts?.length > 0 && (
                                        <div className={styles.alerts}>
                                            {vitalAnalysis.alerts.map((alert, i) => (
                                                <div key={i} className={`${styles.alert} ${styles[alert.type]}`}>
                                                    {alert.message}
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    <p className={styles.recommendation}>{vitalAnalysis.recommendation}</p>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
