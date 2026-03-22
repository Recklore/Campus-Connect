import logoImage from "../../assets/curaj.jpg";

function Brand() {
  return (
    <div className="brand-wrap">
      <img src={logoImage} alt="Central University of Rajasthan logo" className="brand-logo" />
      <span className="brand-name">
        campus-<em>connect</em>
      </span>
    </div>
  );
}

export default Brand;
