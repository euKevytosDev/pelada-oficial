package br.com.peladaoficial;

import java.util.TimeZone;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.security.autoconfigure.UserDetailsServiceAutoConfiguration;

@SpringBootApplication(exclude = {UserDetailsServiceAutoConfiguration.class})
public class PeladaOficialApplication {

	public static void main(String[] args) {
		// Oracle VM fica em UTC; datas da pelada/súmula devem ser calendário do Brasil
		TimeZone.setDefault(TimeZone.getTimeZone("America/Sao_Paulo"));
		SpringApplication.run(PeladaOficialApplication.class, args);
	}

}
