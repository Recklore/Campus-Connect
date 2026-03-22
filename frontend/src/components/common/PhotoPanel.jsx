import buildingImage from "../../assets/curaj_building.jpg";

function PhotoPanel() {
  return (
    <aside className="photo-panel">
      <img src={buildingImage} alt="Central University of Rajasthan campus" className="photo-panel-image" />
      <div className="photo-panel-overlay" />
      <div className="photo-panel-caption">
        <h2>
          Central University
          <br />
          of Rajasthan
        </h2>
        <p>Kishangarh, Ajmer, Rajasthan</p>
      </div>
    </aside>
  );
}

export default PhotoPanel;
